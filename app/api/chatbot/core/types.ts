export type IntentType = 'READ_QUERY' | 'ACTION_REQUEST' | 'NAVIGATION_REQUEST';

export interface ChatbotRequest {
    userId: string;
    userRole: string; // 'CRO', 'Front Desk', 'Doctor', 'Admin'
    userMessage: string;
    context?: Record<string, any>;
}

export interface ChatbotResponse {
    success: boolean;
    message: string;
    data?: any;
    confirmationRequired?: boolean;
    confirmationToken?: any; // Could be a signed token or state object
}

export interface Intent {
    type: IntentType;
    confidence: number;
    entityType?: 'LEAD' | 'PATIENT';
    entityId?: string;
    action?: string; // e.g. 'CONVERT', 'FETCH_STALLING'
    params?: Record<string, any>; // Extracted parameters like 'phone', 'name'
}

export interface AuditLogEntry {
    request_id: string;
    user_id: string;
    role: string;
    intent: string;
    entity_type?: string;
    entity_id?: string;
    action_details: Record<string, any>;
    timestamp?: string; // handled by DB default usually, but useful for logs
}
