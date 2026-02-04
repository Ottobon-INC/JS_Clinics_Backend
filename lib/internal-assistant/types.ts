
export enum Intent {
    GET_STALLING_LEADS = 'GET_STALLING_LEADS',
    GET_TODAY_APPOINTMENTS = 'GET_TODAY_APPOINTMENTS',
    GET_WAITING_PATIENTS = 'GET_WAITING_PATIENTS',
    GET_CONTROL_TOWER_SUMMARY = 'GET_CONTROL_TOWER_SUMMARY',
    UNKNOWN = 'UNKNOWN',
}

export type Role = 'admin' | 'cro' | 'doctor' | 'front_desk';

export interface ChatRequest {
    message: string;
}

export interface ChatResponse {
    reply: string;
    intent?: Intent; // Optional, for debugging/logging, maybe not sent to frontend in prod
}

export interface SanitizationRule {
    allowedFields: string[]; // Whitelist approach
    hashFields?: string[]; // Optional hashing
}

export interface IntentConfig {
    intent: Intent;
    allowedRoles: Role[];
    sanitization: SanitizationRule;
    description: string; // For LLM system prompt
}
