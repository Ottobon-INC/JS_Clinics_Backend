import { NextResponse } from 'next/server';
import { logChatbotAction } from '../core/audit';
import { convertLeadToPatient } from '../handlers/leads';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const requestId = crypto.randomUUID(); // New ID for the confirmation step itself

    try {
        const body = await req.json();
        const { userId, userRole, confirmationToken } = body;

        if (!userId || !confirmationToken) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const { action, leadData, requestId: originalRequestId } = confirmationToken;

        // Log Start of Confirmation
        await logChatbotAction({
            request_id: requestId,
            user_id: userId,
            role: userRole,
            intent: 'CONFIRMATION',
            action_details: { stage: 'CONFIRMATION_RECEIVED', original_request_id: originalRequestId, action }
        });

        if (action === 'CONVERT_LEAD') {
            const result = await convertLeadToPatient(requestId, userId, userRole, leadData);

            await logChatbotAction({
                request_id: requestId,
                user_id: userId,
                role: userRole,
                intent: 'ACTION_REQUEST',
                entity_type: 'LEAD',
                entity_id: leadData.id,
                action_details: { stage: 'CONFIRMATION_EXECUTED', success: result.success, message: result.message }
            });

            return NextResponse.json(result);
        }

        return NextResponse.json({ success: false, message: "Invalid confirmation token" }, { status: 400 });

    } catch (error: any) {
        console.error('CHATBOT CONFIRM ERROR:', error);
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
