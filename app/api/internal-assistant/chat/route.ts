
import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { processUserMessage } from '@/lib/internal-assistant';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        // 1. Validate Session & Auth
        const { user, error: authError } = await validateSession(request);

        if (authError || !user) {
            return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse Body
        const body = await request.json();
        const { message } = body;

        if (!message || typeof message !== 'string') {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // 3. Process Message via Internal Assistant Module
        const response = await processUserMessage(user.id, user.role, message);

        // 4. Return Response
        // Note: We only return the friendly 'reply' to the frontend. 
        // The 'intent' is internal metadata, though we could enable it for debugging if needed.
        return NextResponse.json({
            reply: response.reply,
            // intent: response.intent // Uncomment if frontend needs to know the intent
        });

    } catch (error: any) {
        console.error('POST /api/internal-assistant/chat error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
