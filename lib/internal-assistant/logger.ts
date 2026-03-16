
import { Intent, Role } from './types';

export interface LogInfo {
    userId: string;
    role: Role | string;
    intent: Intent;
    allowed: boolean;
    timestamp: string;
    error?: string;
    durationMs?: number;
}

export class ChatLogger {
    static log(info: LogInfo) {
        // Constraint: No PII (message content) in logs.
        // In a real system, you might write to a DB table 'audit_logs' or a logging service.
        // For now, we use console.log with a structured format.

        const safeLog = {
            level: 'INFO',
            module: 'internal-assistant',
            ...info,
        };

        console.log(JSON.stringify(safeLog));
    }
}
