import { Intent } from './types';

const ROLE_PERMISSIONS: Record<string, string[]> = {
    'CRO': ['READ_QUERY', 'ACTION_REQUEST', 'NAVIGATION_REQUEST'],
    // Add other roles here
};

const ALLOWED_ACTIONS: Record<string, string[]> = {
    'CRO': ['FETCH_STALLING', 'CONVERT_LEAD'],
};

export function isActionAllowed(role: string, intent: Intent): boolean {
    // 1. Check if role exists
    const roleKey = Object.keys(ROLE_PERMISSIONS).find(r => r.toLowerCase() === role.toLowerCase());
    if (!roleKey) return false;

    // 2. Check general intent permission
    const allowedIntents = ROLE_PERMISSIONS[roleKey];
    if (!allowedIntents.includes(intent.type)) return false;

    // 3. Check specific action permission if present
    if (intent.action) {
        const allowedActions = ALLOWED_ACTIONS[roleKey] || [];
        return allowedActions.includes(intent.action);
    }

    return true;
}
