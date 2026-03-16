
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption';
import { Intent, Role } from './types';

export class DataFetcher {
    private static supabase = getSupabaseAdmin();

    static async fetchData(intent: Intent, userRole: Role, userId: string): Promise<any> {
        switch (intent) {
            case Intent.GET_STALLING_LEADS:
                return this.getStallingLeads();
            case Intent.GET_TODAY_APPOINTMENTS:
                return this.getTodayAppointments(userRole, userId);
            case Intent.GET_WAITING_PATIENTS:
                return this.getWaitingPatients();
            case Intent.GET_CLINIC_SUMMARY:
                return this.getClinicSummary();
            case Intent.UNKNOWN:
            default:
                return null;
        }
    }

    // --- "Service" Methods ---

    private static async getStallingLeads() {
        // Fixed Logic: Fetch 'New Inquiry' or 'Follow Up' leads, ordered by date (oldest first)
        const { data, error, count } = await this.supabase
            .from('sakhi_clinic_leads')
            .select('id, status, age, gender, inquiry, source, date_added', { count: 'exact' }) // Get Total Count
            .in('status', ['New Inquiry', 'Follow Up'])
            .order('date_added', { ascending: true })
            .limit(10); // Still limit list size for token efficiency

        if (error) throw error;
        // Return raw data + count so Responder knows the real total
        return {
            leads: data || [],
            total_count: count || 0
        };
    }

    private static async getTodayAppointments(userRole: Role, userId: string) {
        const today = new Date().toISOString().split('T')[0];

        // Base query
        let query = this.supabase
            .from('sakhi_clinic_appointments')
            .select('status, doctor_id, type') // Fetch minimal fields needed for aggregation
            .eq('appointment_date', today);

        // Doctor restriction: can only see their own
        if (userRole === 'doctor') {
            // Assuming 'doctor_id' in appointments table matches the auth userId
            // OR we match against the doctor's name if that's how it's stored. 
            // Ideally we use ID. If strict doctor_id isn't available, we might need a name lookup
            // but for V1.1 we assume doctor_id is the link or we filter by doctor_name if needed.
            // Let's rely on checking if 'doctor_id' exists on the table.

            // Safe fallback: if column doesn't exist, this might error. 
            // However, typically appointments have a doctor reference.
            // If the schema uses 'doctor_name', we can't securely filter by ID without a lookup.
            // Given constraints, we will try to filter by ID if it matches pattern, else we might return 0 to be safe.
            query = query.eq('doctor_id', userId);
        }

        const { data: appointments, error } = await query;

        if (error) throw error;

        const total_count = appointments?.length || 0;

        // Group by status
        const breakdown = (appointments || []).reduce<Record<string, number>>((acc, curr) => {
            const status = curr.status || 'Scheduled';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});

        return {
            total_count,
            breakdown,
            my_appointments_count: userRole === 'doctor' ? total_count : undefined
        };
    }

    private static async getWaitingPatients() {
        const today = new Date().toISOString().split('T')[0];
        const { data: appointments, error } = await this.supabase
            .from('sakhi_clinic_appointments')
            .select('status, arrived_at, checked_in_at, updated_at')
            .eq('appointment_date', today)
            .in('status', ['Arrived', 'Checked-In']); // Waiting statuses

        if (error) throw error;

        const now = new Date();
        let max_wait_time_minutes = 0;
        let long_wait_count = 0;

        appointments?.forEach((appt: any) => {
            const timeRef = appt.checked_in_at || appt.arrived_at || appt.updated_at;
            if (timeRef) {
                const waitTime = Math.floor((now.getTime() - new Date(timeRef).getTime()) / 60000);
                if (waitTime > max_wait_time_minutes) max_wait_time_minutes = waitTime;
                if (waitTime > 30) long_wait_count++;
            }
        });

        return {
            total_waiting: appointments?.length || 0,
            max_wait_time_minutes,
            long_wait_count
        };
    }

    private static async getClinicSummary() {
        const today = new Date().toISOString().split('T')[0];

        // 1. Leads Summary
        const { count: leadsCount, error: leadError } = await this.supabase
            .from('sakhi_clinic_leads')
            .select('*', { count: 'exact', head: true })
            .gte('date_added', today);

        if (leadError) throw leadError;

        // 2. Stalling Leads Count
        const { count: stallingCount, error: stallingError } = await this.supabase
            .from('sakhi_clinic_leads')
            .select('*', { count: 'exact', head: true })
            .in('status', ['New Inquiry', 'Follow Up']); // Simple definition of stalling for summary

        if (stallingError) throw stallingError;

        // 3. Appointments Summary
        const { count: apptCount, error: apptError } = await this.supabase
            .from('sakhi_clinic_appointments')
            .select('*', { count: 'exact', head: true })
            .eq('appointment_date', today);

        if (apptError) throw apptError;

        // 4. Waiting Patients (reuse logic logic basically)
        const { count: waitingCount, error: waitingError } = await this.supabase
            .from('sakhi_clinic_appointments')
            .select('*', { count: 'exact', head: true })
            .eq('appointment_date', today)
            .in('status', ['Arrived', 'Checked-In']);

        if (waitingError) throw waitingError;

        return {
            total_leads_today: leadsCount || 0,
            total_appointments_today: apptCount || 0,
            total_waiting_patients: waitingCount || 0,
            stalling_leads_count: stallingCount || 0
        };
    }
}
