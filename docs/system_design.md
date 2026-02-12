# System Design Document

## 1. Executive Summary
This document provides a high-level overview of the **JS Clinics Backend** system. The application serves as a backend-for-frontend (BFF) and API service for managing clinic operations, including leads, patients, appointments, and dashboard metrics. It leverages **Next.js** for its API capabilities, **Supabase** (PostgreSQL) for data persistence, and a custom **JWT-based authentication** system.

## 2. Architecture Overview
The system follows a monolithic architecture within a Next.js framework, primarily utilizing API Routes (`app/api`) to expose endpoints.

### High-Level Architecture
1.  **API Layer**: Next.js App Router (`app/api/*`) handles incoming HTTP requests.
2.  **Service Layer**: located in `lib/`, provides core business logic, including:
    -   **Authentication**: `lib/auth.ts` (JWT validation).
    -   **Database Access**: `lib/supabase.ts` (Direct Supabase Client).
    -   **Encryption**: `lib/encryption.ts` (AES-256-GCM for sensitive data).
    -   **Utilities**: `lib/utils.ts` (Sanitization, formatting).
3.  **Data Layer**: External Supabase PostgreSQL instance.

### Architecture Diagram
```mermaid
graph TD
    Client[Client Application] -->|HTTPS| API[Next.js API Routes]
    
    subgraph "Backend Service (Next.js)"
        API --> Auth[Auth Middleware (lib/auth)]
        API --> Logic[Business Logic (Controllers)]
        Logic --> Encryption[Encryption Service (lib/encryption)]
        Logic --> SupabaseClient[Supabase Client (lib/supabase)]
    end
    
    SupabaseClient -->|Postgres Protocol/HTTP| Database[(Supabase PostgreSQL)]
    
    subgraph "Data Storage"
        Database
    end
```

## 3. Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | Next.js 14 | App Router for API definition and routing. |
| **Language** | TypeScript 5 | Static typing for reliability and maintainability. |
| **Database** | Supabase (PostgreSQL) | Managed Postgres database. accessed via `@supabase/supabase-js`. |
| **Authentication** | Custom JWT | `jsonwebtoken` for signing/verifying tokens. `password-hash` for credential verification. |
| **AI Integration** | OpenAI SDK | Integrated in `internal-assistant` for intelligent features. |
| **Cryptography** | Node.js Crypto | `aes-256-gcm` for encrypting sensitive patient/lead data (names, issues, etc.). |

## 4. Key Components

### 4.1 Authentication
-   **Method**: Custom JWT (JSON Web Tokens).
-   **Flow**:
    1.  User posts credentials to `/api/auth/login`.
    2.  Backend verifies email and password hash against `sakhi_clinic_users`.
    3.  On success, signs a JWT with `HS256` (implicit default of `jsonwebtoken`) using `JWT_SECRET`.
    4.  Token returned to client.
-   **Middleware**: `validateSession` check in `lib/auth.ts` is called manually in protected routes.

### 4.2 Data Security (Encryption)
-   **Algorithm**: AES-256-GCM.
-   **Usage**: Sensitive fields in `sakhi_clinic_leads` (e.g., `problem`, `treatment_doctor`, `treatment_suggested`) are encrypted at rest.
-   **Key Management**: `ENCRYPTION_KEY` environment variable (Hex string).

### 4.3 Database Access
-   **Pattern**: Direct usage of `supabase-js` client in API routes.
-   **Authorization**: Uses **Service Role Key** (`getSupabaseAdmin`) for all backend operations, effectively bypassing Row Level Security (RLS) on the Supabase side. Access control is enforced at the API layer via `validateSession`.

## 5. Directory Structure
```
/
├── app/
│   └── api/            # API Route definitions
│       ├── leads/      # Lead management
│       ├── patients/   # Patient management
│       ├── appointments/ # Appointment scheduling
│       ├── auth/       # Authentication endpoints
│       └── control-tower/ # Dashboard metrics
├── lib/
│   ├── auth.ts         # Session validation
│   ├── encryption.ts   # AES-256-GCM implementation
│   ├── supabase.ts     # Supabase client initialization
│   ├── utils.ts        # Helper functions
│   └── internal-assistant/ # AI logic
├── scripts/            # Deployment and utility scripts
└── package.json        # Dependencies
```
