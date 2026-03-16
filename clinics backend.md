# System Design & Architecture: Janmasethu Clinical OS

## 1. High-Level Architecture

The Janmasethu Clinical OS is a **Next.js 14** application serving as both the frontend and backend API. It leverages to **Supabase** (PostgreSQL) as its primary data store and **OpenAI** for intelligent features (Internal Assistant).

### System Context Diagram (C4 Level 1)

```mermaid
C4Context
    title System Context Diagram for Janmasethu Clinical OS

    Person(clinic_staff, "Clinic Staff", "Doctors, Receptionists, and Admins who manage clinic operations.")
    
    System_Boundary(clinical_os, "Janmasethu Clinical OS") {
        System(nextjs_app, "Next.js Application", "Handles UI rendering and API requests.")
        SystemDb(supabase_db, "Supabase Database", "Stores users, leads, appointments, and logs.")
    }

    System_Ext(openai, "OpenAI API", "Provides LLM capabilities for the Internal Assistant.")

    Rel(clinic_staff, nextjs_app, "Uses", "HTTPS")
    Rel(nextjs_app, supabase_db, "Reads/Writes Data", "Supabase Client (Service Role)")
    Rel(nextjs_app, openai, "Classifies Intents", "API (GPT-4o)")
```

---

## 2. Technology Stack

| Category | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | Next.js 14 (App Router) | React framework for frontend and backend API. |
| **Language** | TypeScript | Type-safe development. |
| **Database** | Supabase (PostgreSQL) | Managed database service. |
| **Authentication** | Custom JWT + Supabase | Custom `jsonwebtoken` implementation with `sakhi_clinic_users` table. |
| **Encryption** | Node.js Crypto | AES-256-CBC encryption for sensitive patient data. |
| **AI/LLM** | OpenAI (GPT-4o) | Intent classification and response generation. |
| **Hosting** | Vercel (Implied) | Optimized for Next.js. |

---

## 3. Database Schema (Inferred)

The application interacts with a Supabase PostgreSQL database. Key tables and relationships are inferred from the codebase.

### Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    SAKHI_CLINIC_USERS {
        uuid id PK
        string email
        string password_hash
        string role "Admin, Doctor, Receptionist"
        string name
    }

    SAKHI_CLINIC_LEADS {
        uuid id PK
        string name
        string phone
        string status "New Inquiry, Follow Up, Converted, etc."
        timestamp date_added
        string source
        string assigned_to_user_id FK
        text problem "Encrypted"
        text treatment_suggested "Encrypted"
        text treatment_doctor "Encrypted"
    }

    SAKHI_CLINIC_APPOINTMENTS {
        uuid id PK
        date appointment_date
        string status "Scheduled, Arrived, Checked In, Completed, etc."
        string patient_name
        string doctor_name
    }

    SAKHI_CLINIC_USERS ||--o{ SAKHI_CLINIC_LEADS : "assigns to"
```

---

## 4. Key Modules

### 4.1. Authentication (`lib/auth.ts`)
- **Mechanism**: Custom JWT-based authentication.
- **Verification**: Middleware/Helper `validateSession` checks the `Authorization: Bearer <token>` header.
- **Passwords**: Hashed using `password-hash` (with a fallback to plain text check for legacy/dev).
- **Session**: Stateless; token contains user ID, email, and role.

### 4.2. Internal Assistant (`lib/internal-assistant`)
The "brain" of the application, allowing staff to query data and perform actions via chat.

**Architecture Pipeline:**
1.  **Process Request**: `processUserMessage` receives user input.
2.  **Token Check**: Checks for `confirmationToken` (for executing actions like "Check In").
3.  **Intent Classification**: Uses `OpenAI` (GPT-4o) to map natural language to an `Intent` (e.g., `ACTION_CHECK_IN`, `VIEW_LEADS`).
4.  **Gatekeeper (RBAC)**: Checks if the user's `role` is authorized for the `Intent`.
5.  **Search/Fetch**:
    *   **Read**: Fetches data via `DataFetcher`.
    *   **Action**: Searches for candidates (e.g., "Check in John") and returns options with **Confirmation Tokens**.
6.  **Sanitization**: Scrubs sensitive data using `Sanitizer`.
7.  **Response**: Generates a natural language response via `Responder` (LLM-augmented).

### Internal Assistant Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant API as /api/internal-assistant
    participant Core as Assistant Core
    participant LLM as OpenAI (GPT-4o)
    participant DB as Supabase

    User->>API: POST /chat (message)
    API->>Core: processUserMessage(message, role)
    
    alt Confirmation Token Present
        Core->>Core: Validate Token & Action
        Core->>DB: Execute Update (e.g., Check In)
        Core-->>API: Return Success Message
    else Natural Language Query
        Core->>LLM: Classify Intent
        LLM-->>Core: JSON { intent: "CHECK_IN", entity: "John" }
        
        Core->>Core: Gatekeeper.authorize(role, intent)
        
        alt Action Intent (e.g. Check In)
            Core->>DB: Search Candidates ("John")
            DB-->>Core: List of Appointments
            Core-->>API: Return Options with Tokens
        else Read Intent
            Core->>DB: Fetch Data
            DB-->>Core: Raw Data
            Core->>Core: Sanitize Data
            Core->>LLM: Generate Response
            LLM-->>Core: Natural Language Reply
            Core-->>API: Return Reply
        end
    end
```

### 4.3. Leads Management (`app/api/leads`)
- **CRUD**: specific endpoints for creating and listing leads.
- **Normalization**: `normalizeLead` handles CSV import edge cases (e.g., "Lead Name" vs "name", "Status" vs "Source" swaps).
- **Security**: Sensitive medical fields (`problem`, `treatment_suggested`) are **encrypted** at rest using Node.js `crypto`.

### 4.4. Control Tower (`app/api/control-tower`)
- **Purpose**: Operational dashboard for clinic status.
- **Metrics**: Aggregates appointment statuses (`Scheduled`, `Arrived`, `Checked In`, `Completed`) from `sakhi_clinic_appointments` for the current day.
- **Real-time**: Leverages `force-dynamic` to ensure fresh data.

---

## 5. Security Considerations

- **Row Level Security (RLS)**: The backend uses `getSupabaseAdmin()` (Service Role), effectively bypassing RLS. Security is enforced via application-level logic (`Gatekeeper` and `validateSession`).
- **Data Encryption**: Sensitive fields in `Leads` are encrypted before storage.
- **Context Isolation**: The Internal Assistant explicitly checks permissions before executing actions or fetching data.
