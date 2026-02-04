
import { IntentClassifier } from './intent';
import { Gatekeeper } from './gatekeeper';
import { DataFetcher } from './data-fetcher';
import { Sanitizer } from './sanitizer';
import { Responder } from './responder';
import { ChatLogger } from './logger';
import { ChatRequest, ChatResponse, Intent, Role } from './types';

export async function processUserMessage(
    userId: string,
    role: Role | string,
    message: string
): Promise<ChatResponse> {
    const startTime = Date.now();
    let intent = Intent.UNKNOWN;
    let allowed = false;

    try {
        // 1. Feature Flag Check
        if (process.env.INTERNAL_ASSISTANT_ENABLED !== 'true') {
            throw new Error('Internal Assistant is disabled.');
        }

        // 2. Intent Classification
        intent = await IntentClassifier.classify(message);

        // 3. Gatekeeper (RBAC)
        const authResult = Gatekeeper.authorize(role, intent);
        allowed = authResult.allowed;

        if (!allowed) {
            ChatLogger.log({ userId, role, intent, allowed: false, timestamp: new Date().toISOString() });
            return {
                reply: authResult.reason || "You are not authorized to perform this action.",
                intent
            };
        }

        // 4. Data Fetching
        if (intent === Intent.UNKNOWN) {
            // Skip fetching for unknown
            ChatLogger.log({ userId, role, intent, allowed: true, timestamp: new Date().toISOString() });
            const reply = await Responder.generateResponse(intent, null);
            return { reply, intent };
        }

        const rawData = await DataFetcher.fetchData(intent, role as Role, userId);

        // 5. Privacy Filter (Sanitization)
        const sanitizedData = Sanitizer.sanitize(rawData, intent);

        // 6. Response Composition
        const reply = await Responder.generateResponse(intent, sanitizedData);

        // 7. Logging (Success)
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
