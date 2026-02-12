# API Specification

## 1. Authentication
All protected endpoints require a Bearer Token in the `Authorization` header.
`Authorization: Bearer <token>`

### 1.1 Login
**POST** `/api/auth/login`
-   **Body**: `{ "email": "user@example.com", "password": "password123" }`
-   **Response**: `{ "success": true, "token": "jwt_token...", "user": { ... } }`

## 2. Leads Management

### 2.1 Get Leads
**GET** `/api/leads`
-   **Query Params**:
    -   `page`: Page number (default 1)
    -   `limit`: Items per page (default 20)
    -   `phone`: Filter by phone number
    -   `status`: Filter by status
    -   `q`: Search query (name or phone)
-   **Response**: List of leads with pagination. Encrypted fields (`problem`, etc.) are decrypted in the response.

### 2.2 Create Lead
**POST** `/api/leads`
-   **Body**: JSON object with lead details (`name`, `phone`, `status`, etc.).
-   **Logic**:
    -   Validates required fields.
    -   Encrypts sensitive fields (`problem`, `treatment_doctor`, `treatment_suggested`).
    -   Inserts into `sakhi_clinic_leads`.

### 2.3 Get/Update Lead
**GET** `/api/leads/[id]`
**PATCH** `/api/leads/[id]`
-   **Body**: Fields to update.
-   **Logic**: Updates specific lead. Encrypts sensitive fields if they are being updated.

## 3. Patients Management

### 3.1 Get Patients
**GET** `/api/patients`
-   **Query Params**: `phone`, `q`, `page`, `limit`.
-   **Response**: List of registered patients.

### 3.2 Create Patient
**POST** `/api/patients`
-   **Body**: Patient details (`name`, `mobile`, `gender`, etc.).
-   **Logic**:
    -   Checks if patient with mobile already exists.
    -   Generates a unique UHID.
    -   Can link to an existing `lead_id`.

## 4. Appointments Management

### 4.1 Get Appointments
**GET** `/api/appointments`
-   **Query Params**: `date`, `doctor_id`, `status`, `mobile`.
-   **Response**: List of appointments.

### 4.2 Schedule Appointment
**POST** `/api/appointments`
-   **Body**:
    -   `patient_id` OR `lead_id` (Required).
    -   `doctor_id` (Optional).
    -   `appointment_date`, `start_time`, `end_time`.
    -   Snapshot fields (optional overrides).
-   **Logic**:
    -   Creates snapshots of patient/doctor details to freeze them at the time of appointment.
    -   Links to patient/lead/doctor.

## 5. Control Tower (Dashboard)
Analytics endpoints for the admin dashboard.
-   **GET** `/api/control-tower/metrics`: General metrics.
-   **GET** `/api/control-tower/utilization`: Resource utilization.
-   **GET** `/api/control-tower/patient-flow-summary`: Patient flow stats.
-   **GET** `/api/control-tower/live-queue`: Current waiting list.
