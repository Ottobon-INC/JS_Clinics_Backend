# System Architecture Critique

This document identifies areas of **Tight Coupling** and **Flawed System Design** within the codebase. It aims to provide a constructive analysis for future refactoring and stability improvements.

## 1. Tight Coupling

### 1.1. Network & Database Coupling
-   **Problem**: API Route handlers (Controllers) directly import and use the `supabase-js` client.
-   **Evidence**: Files like `app/api/leads/route.ts` contain direct `supabase.from('...').select(...)` calls.
-   **Impact**: The application is tightly coupled to Supabase. Migrating to another database (e.g., raw PostgreSQL, MySQL) or even adding a caching layer would require rewriting every single API route.
-   **Remediation**: Introduce a **Repository Pattern**. Create `services/leadService.ts` that handles data access. The Controller should only call `leadService.getLeads()`.

### 1.2. Business Logic in Controllers
-   **Problem**: "Fat Controllers" pattern. Routes handle HTTP validation, business rules (normalization), encryption, error handling, and database queries all in one function.
-   **Evidence**: `app/api/leads/route.ts` contains a 60+ line `normalizeLead` function and complex field mapping logic mixed with the HTTP response logic.
-   **Impact**: Hard to test business logic in isolation. If you want to "normalize a lead" from a different entry point (e.g., a background job), you cannot reuse this logic easily.
-   **Remediation**: Extract business logic into pure functions/services (e.g., `lib/leads/normalizer.ts`).

### 1.3. Hardcoded dependencies
-   **Problem**: Authentication logic is manually invoked in every route.
-   **Evidence**: `const { error: authError } = await validateSession(request);` is repeated at the top of every secured route.
-   **Impact**: High risk of developer error. Forgetting this single line opens a security vulnerability.
-   **Remediation**: Use Higher-Order Functions (HOF) or Middleware to wrap secure routes.

## 2. Flawed System Design

### 2.1. "Snapshot" Strategy for Appointments
-   **Problem**: The `sakhi_clinic_appointments` table uses columns like `patient_name_snapshot`, `doctor_name_snapshot` to freeze data at the time of booking.
-   **Flaw**: This is a fragile denormalization technique. It relies on the application code to manually copy these fields every time an appointment is created. If a new field needs to be preserved (e.g., "patient_insurance"), the schema and the application logic must be updated simultaneously.
-   **Better Approach**: Use a robust Versioning/History table system or Event Sourcing if strict historical accuracy is required.

### 2.2. Encryption Implementation
-   **Problem**: Encryption/Decryption is applied manually to specific fields within the route handlers.
-   **Flaw**: This "Leaky Abstraction" means the developer must remember *which* fields are encrypted every time they read/write to the DB.
-   **Risk**: It is very easy to accidentally save plain text into an encrypted column or return encrypted gibberish to the frontend.
-   **Better Approach**: Handle encryption at the Data Access Object (DAO)/Repository level, so the rest of the app only ever sees plain text.

### 2.3. Lack of Type Safety & Validation (Input)
-   **Problem**: Heavy reliance on manual string parsing and weak typing.
-   **Evidence**: `normalizeStatus` and `looksLikeSource` functions use extensive string matching and raw definition of valid arrays inside the route.
-   **Flaw**: If valid statuses change in the DB, the code breaks.
-   **Better Approach**: Use a validation library like **Zod** to define schemas and validate incoming payloads strictly against those schemas.

### 2.4. Hardcoded Secrets & Config
-   **Problem**: Fallback secrets in code.
-   **Evidence**: `const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';`
-   **Flaw**: This creates a false sense of security. If the env var fails to load, the app silently switches to a known insecure secret.
-   **Better Approach**: Fail fast. If critical secrets are missing, the application should crash at startup rather than run insecurely.

### 2.5. God Object (`sakhi_clinic_leads`)
-   **Problem**: The `leads` table/module seems to handle everything from raw CSV import mappings (with 50+ variated column names) to patient conversion.
-   **Flaw**: Violates Separation of Concerns.
-   **Better Approach**: Use a temporary `import_staging` table for raw CSV uploads, clean/normalize the data there, and then move clean records to `leads`.

## 3. Summary
The current system is functional but brittle. It relies heavily on "convention over configuration" but implements those conventions manually in every file (Auth, Encryption). Refactoring to a **Layered Architecture** (Controller -> Service -> Repository) would significantly improve maintainability and testability.
