
import { Intent, IntentConfig, Role } from './types';

export const INTENT_CONFIG: Record<Intent, IntentConfig> = {
    [Intent.GET_STALLING_LEADS]: {
        intent: Intent.GET_STALLING_LEADS,
        allowedRoles: ['admin', 'cro'],
        sanitization: {
            allowedFields: ['status', 'reason', 'assigned_to_user_id', 'date_added', 'age', 'gender', 'inquiry', 'source', 'lead_display_id'], // 'lead_display_id' is hypothetical, maybe use 'id' if it's not a UUID
        },
        description: 'Fetch leads that are stalling or have not been followed up recently.',
    },
    [Intent.GET_TODAY_APPOINTMENTS]: {
        intent: Intent.GET_TODAY_APPOINTMENTS,
        allowedRoles: ['admin', 'cro', 'doctor', 'front_desk'],
        sanitization: {
            allowedFields: ['appointment_time', 'status', 'type', 'doctor_name', 'patient_first_name'],
        },
        description: 'Fetch all appointments scheduled for today.',
    },
    [Intent.GET_WAITING_PATIENTS]: {
        intent: Intent.GET_WAITING_PATIENTS,
        allowedRoles: ['admin', 'cro', 'doctor', 'front_desk'],
        sanitization: {
            allowedFields: ['check_in_time', 'wait_time_minutes', 'status', 'token_number'],
        },
        description: 'Fetch list of patients currently waiting in the clinic.',
    },
    [Intent.GET_CONTROL_TOWER_SUMMARY]: {
        intent: Intent.GET_CONTROL_TOWER_SUMMARY,
        allowedRoles: ['admin', 'cro'],
        sanitization: {
            allowedFields: ['total_leads_today', 'total_appointments_today', 'lead_status_breakdown', 'revenue', 'critical_alerts_count'],
        },
        description: 'Get a high-level summary of clinic operations from the Control Tower.',
    },
    [Intent.UNKNOWN]: {
        intent: Intent.UNKNOWN,
        allowedRoles: ['admin', 'cro', 'doctor', 'front_desk'], // Everyone can get the "I don't understand" message
        sanitization: { allowedFields: [] },
        description: 'Fallback when the intent is not recognized.',
    },
};
