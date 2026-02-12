import { ActionIntent } from './types';
import { v4 as uuidv4 } from 'uuid';

export interface PendingAction {
    token: string;
    userId: string;
    actionType: ActionIntent; // e.g. ACTION_CHECK_IN_PATIENT
    payload: any; // e.g. { appointmentId: '...' }
    createdAt: number;
}

const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 Minutes

class PendingActionStore {
    private store: Map<string, PendingAction> = new Map();

    createToken(userId: string, actionType: ActionIntent, payload: any): string {
        const token = uuidv4(); // Opaque token
        const action: PendingAction = {
            token,
            userId,
            actionType,
            payload,
            createdAt: Date.now()
        };
        this.store.set(token, action);
        return token;
    }

    /**
     * Retrieves AND removes the token (One-time use correction).
     */
    consumeToken(token: string): PendingAction | null {
        const action = this.store.get(token);

        if (!action) return null;

        // Check Expiry
        if (Date.now() - action.createdAt > TOKEN_EXPIRY_MS) {
            this.store.delete(token);
            return null;
        }

        // Verify userId matches (handled by caller typically, but good practice to verify)
        // Here we just return it, and let caller verify userId matches the session.

        // Remove from store to prevent reuse
        this.store.delete(token);

        return action;
    }

    // Cleanup helper (optional, could be run periodically)
    cleanup() {
        const now = Date.now();
        for (const [key, val] of this.store.entries()) {
            if (now - val.createdAt > TOKEN_EXPIRY_MS) {
                this.store.delete(key);
            }
        }
    }
}

export const PendingActions = new PendingActionStore();
