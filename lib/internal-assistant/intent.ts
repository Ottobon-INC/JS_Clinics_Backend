
import OpenAI from 'openai';
import { Intent } from './types';
import { INTENT_CONFIG } from './config';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export class IntentClassifier {
    static async classify(message: string): Promise<{ intent: Intent, searchHint?: string }> {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('sk-placeholder')) {
            console.warn('OpenAI API Key is missing or invalid. Returning UNKNOWN.');
            return { intent: Intent.UNKNOWN };
        }

        try {
            const validIntents = Object.values(INTENT_CONFIG)
                .filter(c => c.intent !== Intent.UNKNOWN)
                .map(c => `- ${c.intent}: ${c.description}`)
                .join('\n');

            const systemPrompt = `
You are an intent classifier for a clinic OS internal assistant.
Your job is to map the user's message to one of the following intents:

${validIntents}

- UNKNOWN: If the message does not match any of the above.

Rules:
1. Output JSON ONLY.
2. Structure: { "intent": "INTENT_NAME", "searchHint": "extracted entity" }
3. "searchHint" is needed for ACTION_CHECK_IN_PATIENT, ACTION_MARK_APPOINTMENT_COMPLETED, and ACTION_MARK_PATIENT_NO_SHOW (extract the patient name).
4. For others, "searchHint" can be null.
      `.trim();

            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message },
                ],
                temperature: 0,
                response_format: { type: "json_object" }, // Enforce JSON
                max_tokens: 100,
            });

            const content = response.choices[0]?.message?.content?.trim();
            if (content) {
                const parsed = JSON.parse(content);
                if (parsed.intent && parsed.intent in Intent) {
                    return { intent: parsed.intent as Intent, searchHint: parsed.searchHint };
                }
            }

            return { intent: Intent.UNKNOWN };

        } catch (error) {
            console.error('Error classifying intent:', error);
            return { intent: Intent.UNKNOWN };
        }
    }
}
