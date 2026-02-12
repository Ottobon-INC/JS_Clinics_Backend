
import { IntentClassifier } from './intent';
import { Gatekeeper } from './gatekeeper';
import { DataFetcher } from './data-fetcher';
import { Sanitizer } from './sanitizer';
import { Responder } from './responder';
import { ChatLogger } from './logger';
import { ChatRequest, ChatResponse, Intent, Role } from './types';
import { CheckInAction } from './actions/check-in';
import { MarkCompletedAction } from './actions/mark-completed';
import { MarkNoShowAction } from './actions/mark-no-show';
import { PendingActions } from './pending-actions';



export async function processUserMessage(
    userId: string,
    role: Role | string,
    message: string, // Kept for classification
    confirmationToken?: string // Step 5 input
): Promise<ChatResponse> {
    const startTime = Date.now();
    let intent = Intent.UNKNOWN;
    let allowed = false;

    try {
        if (process.env.INTERNAL_ASSISTANT_ENABLED !== 'true') {
            throw new Error('Internal Assistant is disabled.');
        }

        // =========================================================
        // STEP 6: BACKEND EXECUTION (NO LLM, NO CLASSIFICATION)
        // =========================================================
        if (confirmationToken) {
            // 6a. Validate Token
            const pendingAction = PendingActions.consumeToken(confirmationToken);

            if (!pendingAction) {
                return { reply: "This confirmation link has expired or is invalid. Please start over.", intent: Intent.UNKNOWN };
            }

            // 6b. Validate ownership (Optional extra check)
            if (pendingAction.userId !== userId) {
                return { reply: "Unauthorized action.", intent: Intent.UNKNOWN };
            }

            // 6c. Execute Action
            if (pendingAction.actionType === Intent.ACTION_CHECK_IN_PATIENT) {
                const { appointmentId } = pendingAction.payload;
                const result = await CheckInAction.execute(appointmentId, userId, role);

                ChatLogger.log({ userId, role, intent: Intent.ACTION_CHECK_IN_PATIENT, allowed: true, timestamp: new Date().toISOString(), durationMs: Date.now() - startTime });

                return {
                    reply: result.message,
                    intent: Intent.ACTION_CHECK_IN_PATIENT,
                };
            }
            if (pendingAction.actionType === Intent.ACTION_MARK_APPOINTMENT_COMPLETED) {
                const { appointmentId } = pendingAction.payload;
                const result = await MarkCompletedAction.execute(appointmentId, userId, role);

                ChatLogger.log({ userId, role, intent: Intent.ACTION_MARK_APPOINTMENT_COMPLETED, allowed: true, timestamp: new Date().toISOString(), durationMs: Date.now() - startTime });

                return {
                    reply: result.message,
                    intent: Intent.ACTION_MARK_APPOINTMENT_COMPLETED,
                };
            }
            if (pendingAction.actionType === Intent.ACTION_MARK_PATIENT_NO_SHOW) {
                const { appointmentId } = pendingAction.payload;
                const result = await MarkNoShowAction.execute(appointmentId, userId, role);

                ChatLogger.log({ userId, role, intent: Intent.ACTION_MARK_PATIENT_NO_SHOW, allowed: true, timestamp: new Date().toISOString(), durationMs: Date.now() - startTime });

                return {
                    reply: result.message,
                    intent: Intent.ACTION_MARK_PATIENT_NO_SHOW,
                };
            }
        }

        // =========================================================
        // STEP 2: INTENT CLASSIFICATION (LLM)
        // =========================================================
        // Only if no token present
        const classification = await IntentClassifier.classify(message);
        intent = classification.intent;
        const searchHint = classification.searchHint;

        // =========================================================
        // STEP 3: RESOLUTION & SEARCH (BACKEND ONLY)
        // =========================================================
        if (intent === Intent.ACTION_CHECK_IN_PATIENT || intent === Intent.ACTION_MARK_APPOINTMENT_COMPLETED || intent === Intent.ACTION_MARK_PATIENT_NO_SHOW) {

            // RBAC Check first
            const authResult = Gatekeeper.authorize(role, intent);
            if (!authResult.allowed) {
                ChatLogger.log({ userId, role, intent, allowed: false, timestamp: new Date().toISOString() });
                return { reply: authResult.reason || "Unauthorized.", intent };
            }

            if (!searchHint) {
                return { reply: "Who is the patient? Please provide a name.", intent };
            }

            // Perform Search based on Intent
            let candidates: any[] = [];
            if (intent === Intent.ACTION_CHECK_IN_PATIENT) {
                candidates = await CheckInAction.search(searchHint);
            } else if (intent === Intent.ACTION_MARK_APPOINTMENT_COMPLETED) {
                candidates = await MarkCompletedAction.search(searchHint);
            } else if (intent === Intent.ACTION_MARK_PATIENT_NO_SHOW) {
                candidates = await MarkNoShowAction.search(searchHint);
            }

            if (candidates.length === 0) {
                return { reply: `I couldn't find any relevant appointments for "${searchHint}" from today or the last 3 days.`, intent };
            }

            // =========================================================
            // STEP 4: CONFIRMATION STATE (BACKEND ONLY)
            // =========================================================
            const options = candidates.map(c => {
                // Create secure token for each option
                const token = PendingActions.createToken(userId, intent as any, { appointmentId: c.id });
                return {
                    label: `${c.patientName} – ${c.time} – ${c.doctorName} (${c.currentStatus})`,
                    token,
                    // We can pass other metadata if UI needs it, but 'token' is what we need back.
                };
            });

            return {
                reply: `I found ${candidates.length} match(es) for "${searchHint}". Please select the appointment:`,
                intent,
                actionRequired: true,
                options
            };
        }


        // =========================================================
        // STANDARD READ-ONLY FLOW
        // =========================================================

        // Gatekeeper (RBAC)
        const authResult = Gatekeeper.authorize(role, intent);
        allowed = authResult.allowed;

        if (!allowed) {
            ChatLogger.log({ userId, role, intent, allowed: false, timestamp: new Date().toISOString() });
            return {
                reply: authResult.reason || "You are not authorized to perform this action.",
                intent
            };
        }

        // Data Fetching
        if (intent === Intent.UNKNOWN) {
            ChatLogger.log({ userId, role, intent, allowed: true, timestamp: new Date().toISOString() });
            const reply = await Responder.generateResponse(intent, null, message);
            return { reply, intent };
        }

        const rawData = await DataFetcher.fetchData(intent, role as Role, userId);

        // Privacy Filter (Sanitization)
        const sanitizedData = Sanitizer.sanitize(rawData, intent);

        // Response Composition
        const reply = await Responder.generateResponse(intent, sanitizedData, message);

        // Logging (Success)
        ChatLogger.log({
            userId,
            role,
            intent,
            allowed: true,
            timestamp: new Date().toISOString(),
            durationMs: Date.now() - startTime
        });

        return { reply, intent };

    } catch (error: any) {
        console.error('Error in processUserMessage:', error);
        ChatLogger.log({
            userId,
            role,
            intent,
            allowed: allowed, // State at time of error
            timestamp: new Date().toISOString(),
            error: error.message
        });

        return {
            reply: "An internal error occurred while processing your request.",
            intent: Intent.UNKNOWN
        };
    }
}
