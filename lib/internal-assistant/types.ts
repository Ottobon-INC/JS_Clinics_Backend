
export enum Intent {
    GET_STALLING_LEADS = 'GET_STALLING_LEADS',
    GET_TODAY_APPOINTMENTS = 'GET_TODAY_APPOINTMENTS',
    GET_WAITING_PATIENTS = 'GET_WAITING_PATIENTS',
    GET_CLINIC_SUMMARY = 'GET_CLINIC_SUMMARY',
    ACTION_CHECK_IN_PATIENT = 'ACTION_CHECK_IN_PATIENT',
    ACTION_MARK_APPOINTMENT_COMPLETED = 'ACTION_MARK_APPOINTMENT_COMPLETED',
    ACTION_MARK_PATIENT_NO_SHOW = 'ACTION_MARK_PATIENT_NO_SHOW',
    UNKNOWN = 'UNKNOWN',
}

export type ActionIntent =
    | Intent.ACTION_CHECK_IN_PATIENT
    | Intent.ACTION_MARK_APPOINTMENT_COMPLETED
    | Intent.ACTION_MARK_PATIENT_NO_SHOW;

export type Role = 'admin' | 'cro' | 'doctor' | 'front_desk';

export interface ChatRequest {
    message: string;
    confirmationToken?: string; // For Step 5 (Confirmation Flow)
}

export interface ChatResponse {
    reply: string;
    intent?: Intent;
    actionRequired?: boolean; // If true, UI should show options
    options?: any[]; // Confirmation options
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
    confirmationRequired?: boolean;
}
