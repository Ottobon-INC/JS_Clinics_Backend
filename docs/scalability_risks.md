# Scalability & Performance Vulnerabilities

This document outlines potential bottlenecks that will degrade system performance as the application scales in terms of data volume and concurrent users.

## 1. Database Performance Risks

### 1.1. Inefficient Wildcard Searches (`ilike %...%`)
-   **Vulnerability**: The `GET /api/leads` and `GET /api/patients` endpoints use leading wildcard searches:
    ```typescript
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
    ```
-   **Why it fails at scale**: Leading wildcards prevent PostgreSQL from using standard B-Tree indexes. This forces a **Full Table Scan** for every search query.
-   **Impact**:
    -   1,000 records: < 10ms (Fast)
    -   100,000 records: ~200-500ms (Noticeable lag)
    -   1,000,000 records: > 2s (Timeout risk, high DB CPU)
-   **Mitigation**: Use PostgreSQL Full Text Search (`tsvector`) or `pg_trgm` GIN indexes.

### 1.2. "Count Exact" on Large Tables
-   **Vulnerability**: `GET /api/leads` requests an exact count for pagination:
    ```typescript
    .select('*', { count: 'exact' })
    ```
-   **Why it fails at scale**: Counting all rows matching a filter becomes increasingly expensive in PostgreSQL MVCC architecture.
-   **Impact**: Even if the page size is small (20), the DB must scan all matching rows to count them.
-   **Mitigation**: Use "Estimated Count" for filtering or infinite scroll UI that doesn't rely on total pages.

### 1.3. In-Memory Aggregation
-   **Vulnerability**: The `GET /api/control-tower/metrics` endpoint fetches **all* of today's appointments and counts them in JavaScript:
    ```typescript
    const { data: appointments } = await supabase.from('...').select('status')...
    const counts = (appointments || []).reduce(...)
    ```
-   **Why it fails at scale**: If a clinic has thousands of appointments/day (or if the query range widens), this increases memory usage on the backend serverless function and data transfer latency.
-   **Impact**: High memory usage, potential OOM (Out of Memory) crashes.
-   **Mitigation**: Perform aggregation in the database using `.rpc()` calls or Supabase Views (e.g., `SELECT status, count(*) FROM ... GROUP BY status`).

## 2. Infrastructure & Application Risks

### 2.1. Serverless Cold Starts & Connection Overhead
-   **Vulnerability**: Currently, a new Supabase client is instantiated inside every route handler:
    ```typescript
    const supabase = getSupabaseAdmin(); // Helper creates new client
    ```
-   **Why it fails at scale**: High concurrency triggers many separate TCP/SSL handshakes to Supabase.
-   **Impact**: Increased latency for every request.
-   **Mitigation**: Supabase client is lightweight, but ensure Global connection pooling is active on the DB side (Supabase Transaction Pooler).

### 2.2. CPU-Intensive Encryption
-   **Vulnerability**: `aes-256-gcm` is fast, but per-field encryption/decryption in Node.js Event Loop can block the main thread under high load.
-   **Scenario**: Fetching 50 leads = 150 decryption operations.
-   **Impact**: Event loop lag, delaying other lightweight requests.
-   **Mitigation**: Offload sensitive data processing to a separate service or assume encryption overhead is the price of security (accept lower throughput).

### 2.3. No Rate Limiting
-   **Vulnerability**: There is no visible rate limiting middleware.
-   **Impact**: A malicious actor or a buggy frontend loop could spam the API, exhausting database connections or incurring high costs (if usages are billed).
-   **Mitigation**: Implement `@upstash/ratelimit` or similar edge-compatible rate limiting.

## 3. Data Integrity & Management Risks

### 3.1. Snapshot Bloat
-   **Vulnerability**: The `appointments` table stores snapshots of patient/doctor details.
-   **Why it fails at scale**: While this improves *read* speed (no joins), it increases storage size significantly as appointment history grows.
-   **Impact**: Larger backup sizes, increased storage costs.
-   **Mitigation**: Acceptable trade-off for auditability, but ensure archival policies are in place for old data.
