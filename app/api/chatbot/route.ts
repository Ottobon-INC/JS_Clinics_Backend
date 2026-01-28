import { NextResponse } from 'next/server';
import { detectIntent } from './core/orchestrator';
import { isActionAllowed } from './core/permissions';
import { logChatbotAction } from './core/audit';
import { fetchStallingLeads, getLeadByPhone } from './handlers/leads';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const requestId = crypto.randomUUID();

    try {
        const body = await req.json();
        const { userId, userRole, userMessage } = body;

        if (!userId || !userRole || !userMessage) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        // 1. Detect Intent
        const intent = detectIntent(userMessage);

        // 2. Log Access Attempt
        await logChatbotAction({
            request_id: requestId,
            user_id: userId,
            role: userRole,
            intent: intent.type,
            entity_type: intent.entityType,
            action_details: { stage: 'INTENT_DETECTED', raw_message: userMessage, detected_intent: intent }
        });

        // 3. Permission Check
        if (!isActionAllowed(userRole, intent)) {
            await logChatbotAction({
                request_id: requestId,
                user_id: userId,
                role: userRole,
                intent: intent.type,
                action_details: { stage: 'PERMISSION_DENIED' }
            });
            return NextResponse.json({ success: false, message: 'Permission denied for this request.' }, { status: 403 });
        }

        // 4. Execute Logic based on Action
        switch (intent.action) {
            case 'FETCH_STALLING': {
                const result = await fetchStallingLeads();
                await logChatbotAction({
                    request_id: requestId,
                    user_id: userId,
                    role: userRole,
                    intent: intent.type,
                    action_details: { stage: 'ACTION_EXECUTED', result_summary: 'Fetched leads' }
                });
                return NextResponse.json({ success: true, message: result });
            }

            case 'CONVERT_LEAD': {
                if (!intent.params?.phone) {
                    return NextResponse.json({ success: false, message: "Could not detect phone number for conversion." });
                }

                const lead = await getLeadByPhone(intent.params.phone);
                if (!lead) {
                    return NextResponse.json({ success: false, message: `Could not find a lead with phone ${intent.params.phone}.` });
                }

                // Return Confirmation Request
                return NextResponse.json({
                    success: true,
                    message: `Found lead ${lead.name} (${lead.phone}). Do you want to convert them to a Patient?`,
                    confirmationRequired: true,
                    confirmationToken: {
                        action: 'CONVERT_LEAD',
                        leadData: lead, // Passing minimal data usually better, but for MVP this ensures we have what we need
                        requestId // Link to original request
                    }
                });
            }

            case 'UNKNOWN':
            default:
                return NextResponse.json({
                    success: false,
                    message: "I didn't understand that. You can ask me to 'Show stalling leads' or 'Convert lead X to patient'."
                });
        }

    } catch (error: any) {
        console.error('CHATBOT API ERROR:', error);
        await logChatbotAction({
            request_id: requestId,
            user_id: 'SYSTEM',
            role: 'SYSTEM',
            intent: 'ERROR',
            action_details: { error: error.message }
        });
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
