
import OpenAI from 'openai';
import { Intent } from './types';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export class Responder {
    static async generateResponse(intent: Intent, data: any, userMessage: string = ""): Promise<string> {
        if (intent === Intent.UNKNOWN) {
            return "I'm sorry, I didn't understand that request. I can help you with stalling leads, today's appointments, waiting patients, or a clinic summary.";
        }

        if (!data) {
            return "I found no data matching your request.";
        }

        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('sk-placeholder')) {
            return `[System]: API Key missing. Data retrieved: ${JSON.stringify(data, null, 2)}`;
        }

        try {
            let contextNote = "";
            if (intent === Intent.GET_STALLING_LEADS) {
                contextNote = "Note: The provided list contains leads that are considered 'stalling' because they have been in 'New Inquiry' or 'Follow Up' status for a long time without conversion. Please treat them as stalling leads.";
            }

            const systemPrompt = `
You are a helpful internal assistant for a clinic.
Your task is to answer the user's question based ONLY on the provided JSON data.
${contextNote}

Rules:
1. Do NOT make up facts.
2. Do NOT infer information not present in the data.
3. Keep the response natural, concise, and professional.
4. If the data is empty or indicates "0", state that clearly.
5. Refer to "Display IDs" or "First Names" if present, do not expose internal UUIDs unless explicitly shown in the "lead_display_id" field.
      `.trim();

            const response = await openai.chat.completions.create({
                model: 'gpt-4o', // or gpt-3.5-turbo
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Original Question: "${userMessage}"\nIntent: ${intent}\nData: ${JSON.stringify(data)}` },
                ],
                temperature: 0.2, // Low temperature for factual accuracy
            });

            return response.choices[0]?.message?.content || "I couldn't generate a response.";

        } catch (error) {
            console.error('Error generating response:', error);
            return "I encountered an error while composing the response.";
        }
    }
}
