import { getSupabaseAdmin } from '@/lib/supabase';
import { AuditLogEntry } from './types';

export async function logChatbotAction(entry: AuditLogEntry) {
    const supabase = getSupabaseAdmin();

    try {
        const { error } = await supabase
            .from('sakhi_clinics_chatbotauditlogs')
            .insert({
                request_id: entry.request_id,
                user_id: entry.user_id,
                role: entry.role,
                intent: entry.intent,
                entity_type: entry.entity_type,
                entity_id: entry.entity_id,
                action_details: entry.action_details,
            });

        if (error) {
            console.error('FAILED TO LOG AUDIT:', error);
            // We don't throw here to avoid failing the user request just because logging failed,
            // BUT for a "strictly audited" system, maybe we should.
            // For now, logging to console as fallback is safer for availability.
        }
    } catch (e) {
        console.error('AUDIT LOG EXCEPTION:', e);
    }
}
