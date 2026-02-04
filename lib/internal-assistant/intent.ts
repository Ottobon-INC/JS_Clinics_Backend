
import OpenAI from 'openai';
import { Intent } from './types';
import { INTENT_CONFIG } from './config';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export class IntentClassifier {
    static async classify(message: string): Promise<Intent> {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('sk-placeholder')) {
            console.warn('OpenAI API Key is missing or invalid. Returning UNKNOWN.');
            return Intent.UNKNOWN;
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

Output ONLY the Intent Name (e.g., GET_STALLING_LEADS). Do not add any explanation.
      `.trim();

            const response = await openai.chat.completions.create({
                model: 'gpt-4o', // or gpt-3.5-turbo
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message },
                ],
                temperature: 0,
                max_tokens: 20,
            });

            const text = response.choices[0]?.message?.content?.trim();

            if (text && text in Intent) {
                return text as Intent;
            }

            return Intent.UNKNOWN;

        } catch (error) {
            console.error('Error classifying intent:', error);
            return Intent.UNKNOWN;
        }
    }
}
