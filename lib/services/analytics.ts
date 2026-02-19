import { getSupabaseAdmin } from '@/lib/supabase';

export interface DoctorUtilizationStats {
    doctorName: string;
    totalAppointments: number;
    completed: number;
    pending: number;
}

export class AnalyticsService {
    /**
     * Get doctor utilization stats for a specific date (defaults to today)
     */
    static async getDoctorUtilization(dateStr?: string): Promise<DoctorUtilizationStats[]> {
        const supabase = getSupabaseAdmin();
        // Default to today in YYYY-MM-DD format
        const targetDate = dateStr || new Date().toISOString().split('T')[0];

        const { data: appointments, error } = await supabase
            .from('sakhi_clinic_appointments')
            .select(`
                id,
                status,
                doctor_id,
                doctor_name_snapshot
            `)
            .eq('appointment_date', targetDate);

        if (error) throw error;

        const statsByDoctor: Record<string, { total: number; completed: number; pending: number; name: string }> = {};

        (appointments || []).forEach((appt: any) => {
            // Use name snapshot or relation or ID as fallback
            const doctorName = appt.doctor_name_snapshot || 'Unassigned';

            // We can group by doctor Name for display, or doctor ID. 
            // Keying by ID if available, but for unassigned we group them.
            const key = appt.doctor_id || 'unassigned';

            if (!statsByDoctor[key]) {
                statsByDoctor[key] = { total: 0, completed: 0, pending: 0, name: doctorName };
            }

            // If we encounter a real name for an ID that was previously unknown (unlikely with snapshot), update it.
            if (statsByDoctor[key].name === 'Unassigned' && doctorName !== 'Unassigned') {
                statsByDoctor[key].name = doctorName;
            }

            statsByDoctor[key].total += 1;

            if (appt.status === 'Completed') {
                statsByDoctor[key].completed += 1;
            } else {
                statsByDoctor[key].pending += 1;
            }
        });

        const result = Object.values(statsByDoctor).map(stat => ({
            doctorName: stat.name,
            totalAppointments: stat.total,
            completed: stat.completed,
            pending: stat.pending
        }));

        return result;
    }
}
