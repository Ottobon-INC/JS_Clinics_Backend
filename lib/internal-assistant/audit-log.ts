import { getSupabaseAdmin } from '@/lib/supabase';
import { Role } from './types';

interface AuditParams {
    userId: string;
    role: Role | string;
    action: string;
    targetId?: string; // e.g., appointment_id
    details?: any; // Extra metadata
}

export class AuditLogger {
    static async log(params: AuditParams) {
        // In a real production system, this would write to a dedicated 'sakhi_audit_logs' table.
        // For V1.1, we will console log (which is captured in server logs) 
        // AND potentially write to a simple table if it exists, otherwise strict console.

        const timestamp = new Date().toISOString();
        const logEntry = {
            ...params,
            timestamp
        };

        // 1. Console Log (Always)
        console.log('[AUDIT_LOG]', JSON.stringify(logEntry));

        // 2. DB Log (Optional enhancement)
        // const supabase = getSupabaseAdmin();
        // await supabase.from('sakhi_audit_logs').insert(...)
    }
}
