
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
                return this.getTodayAppointments();
            case Intent.GET_WAITING_PATIENTS:
                return this.getWaitingPatients();
            case Intent.GET_CONTROL_TOWER_SUMMARY:
                return this.getControlTowerSummary();
            case Intent.UNKNOWN:
            default:
                return null; // Should be handled by orchestrator, but just in case
        }
    }

    // --- "Service" Methods ---

    private static async getStallingLeads() {
        // Fixed Logic: Fetch 'New Inquiry' or 'Follow Up' leads, ordered by date (oldest first)
        // Avoids 'ilike' on ENUM types which causes DB errors.
        const { data, error } = await this.supabase
            .from('sakhi_clinic_leads')
            .select('id, name, status, age, gender, inquiry, source, date_added, assigned_to_user_id')
            .in('status', ['New Inquiry', 'Follow Up'])
            .order('date_added', { ascending: true })
            .limit(10); // Focus on the top 10 stalled ones

        if (error) throw error;

        // Decrypt sensitive fields if necessary (though most here seem plain text, check schema if needed)
        // Assuming 'table_notes' or 'inquiry' might need it if encrypted. 
        // Based on leads route, 'problem', 'treatment_suggested' are encrypted.
        // Let's verify if we need those. 'table_notes' is often where reasons like "Cost" are.

        // For now, return as is, but if 'inquiry' is the 'problem' column alias, we need to know.
        // Leads route maps 'problem' -> 'problem'.

        return data;
    }

    private static async getTodayAppointments() {
        const today = new Date().toISOString().split('T')[0];
        const { data: appointments, error } = await this.supabase
            .from('sakhi_clinic_appointments')
            .select(`
        id,
        status,
        appointment_date,
        appointment_date,
        type,
        doctor_name_snapshot,
        patient_name_snapshot,
        sakhi_clinic_patients ( name )
      `)
            .eq('appointment_date', today);

        if (error) throw error;

        return appointments.map((appt: any) => ({
            ...appt,
            doctor_name: appt.doctor_name_snapshot,
            patient_first_name: (appt.patient_name_snapshot || appt.sakhi_clinic_patients?.name || '').split(' ')[0]
        }));
    }

    private static async getWaitingPatients() {
        const today = new Date().toISOString().split('T')[0];
        // Replicating "Live Queue" logic
        const { data: appointments, error } = await this.supabase
            .from('sakhi_clinic_appointments')
            .select(`
        status,
        updated_at,
        arrived_at,
        checked_in_at,
        sakhi_clinic_patients ( name )
      `)
            .eq('appointment_date', today)
            .in('status', ['Arrived', 'Checked-In']);

        if (error) throw error;

        const now = new Date();
        return appointments?.map((appt: any) => {
            const timeRef = appt.checked_in_at || appt.arrived_at || appt.updated_at;
            const waitTimeMinutes = timeRef
                ? Math.floor((now.getTime() - new Date(timeRef).getTime()) / 60000)
                : 0;

            return {
                status: appt.status,
                wait_time_minutes: waitTimeMinutes,
                patient_first_name: (appt.sakhi_clinic_patients?.name || '').split(' ')[0]
            };
        }) || [];
    }

    private static async getControlTowerSummary() {
        const today = new Date().toISOString().split('T')[0];

        // Lead Summary (Today)
        const { data: leads, error: leadError } = await this.supabase
            .from('sakhi_clinic_leads')
            .select('status')
            .gte('date_added', today);

        if (leadError) throw leadError;

        const leadCounts = (leads || []).reduce<Record<string, number>>((acc, curr) => {
            const status = curr.status || 'New';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});

        // Appointment Summary (Today)
        const { count: apptCount, error: apptError } = await this.supabase
            .from('sakhi_clinic_appointments')
            .select('*', { count: 'exact', head: true })
            .eq('appointment_date', today);

        if (apptError) throw apptError;

        return {
            total_leads_today: leads?.length || 0,
            total_appointments_today: apptCount || 0,
            lead_status_breakdown: leadCounts
        };
    }
}
