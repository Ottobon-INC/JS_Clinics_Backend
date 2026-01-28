-- Create table for Chatbot Audit Logs
create table if not exists sakhi_clinics_chatbotauditlogs (
    id uuid default gen_random_uuid() primary key,
    request_id uuid not null,         -- Trace ID for the chatbot interaction
    user_id uuid,                     -- ID of the user (nullable if system)
    role text,                        -- Role of the user (e.g., 'CRO')
    intent text,                      -- Detected intent (e.g., 'READ_QUERY', 'ACTION_REQUEST')
    entity_type text,                 -- Type of entity involved (e.g., 'lead', 'patient')
    entity_id uuid,                   -- ID of the entity
    action_details jsonb,             -- JSON details of the action or error
    timestamp timestamptz default now()
);

-- Index for faster querying by request_id and timestamp
create index if not exists idx_chatbot_audit_request_id on sakhi_clinics_chatbotauditlogs(request_id);
create index if not exists idx_chatbot_audit_timestamp on sakhi_clinics_chatbotauditlogs(timestamp);
