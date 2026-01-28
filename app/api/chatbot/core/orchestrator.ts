import { Intent } from './types';

export function detectIntent(message: string): Intent {
    const lowerMsg = message.toLowerCase();

    // RULE 1: Fetch Stalling Leads
    if (
        lowerMsg.includes('stalling lead') ||
        (lowerMsg.includes('stalling') && lowerMsg.includes('show')) ||
        (lowerMsg.includes('list') && lowerMsg.includes('stalling'))
    ) {
        return {
            type: 'READ_QUERY',
            confidence: 1.0,
            action: 'FETCH_STALLING',
            entityType: 'LEAD'
        };
    }

    // RULE 2: Convert Lead
    // Pattern: "convert lead <phone/id> to patient"
    if (lowerMsg.includes('convert') && lowerMsg.includes('patient')) {
        // Extract potential identifier (phone or partial ID)
        // Simple logic: look for digits or UUID-like strings
        // Phone regex (simplistic 10 digits)
        const phoneMatch = message.match(/\b\d{10}\b/);

        // If we want to support IDs, it's harder in natural language. stick to phone for now or context.

        const params: Record<string, any> = {};
        if (phoneMatch) {
            params.phone = phoneMatch[0];
        }

        // Also try to capture a name if it says "convert lead John to patient" - harder with regex.
        // relying on previous context is better, but here we just pass intent.

        return {
            type: 'ACTION_REQUEST',
            confidence: 0.9,
            action: 'CONVERT_LEAD',
            entityType: 'LEAD',
            params
        };
    }

    // Fallback
    return {
        type: 'READ_QUERY',
        confidence: 0.0,
        action: 'UNKNOWN'
    };
}
