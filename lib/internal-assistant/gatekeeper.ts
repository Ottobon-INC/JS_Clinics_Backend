
import { Intent, Role } from './types';
import { INTENT_CONFIG } from './config';

export class Gatekeeper {
    static authorize(role: Role | string, intent: Intent): { allowed: boolean; reason?: string } {
        const config = INTENT_CONFIG[intent];

        if (!config) {
            // Should not happen if all intents are in config, but handle gracefully
            return { allowed: false, reason: 'Unknown intent configuration' };
        }

        const normalizedRole = role.toLowerCase();

        // flexible check 
        if (config.allowedRoles.some(r => r.toLowerCase() === normalizedRole)) {
            return { allowed: true };
        }

        return {
            allowed: false,
            reason: `Access denied. Role '${role}' is not authorized for intent '${intent}'.`
        };
    }
}
