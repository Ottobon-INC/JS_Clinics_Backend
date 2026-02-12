import { getSupabaseAdmin } from '@/lib/supabase';
import { AuditLogger } from '../audit-log';
import { Role } from '../types';

export class MarkCompletedAction {
    private static supabase = getSupabaseAdmin();

    static async search(nameHint: string) {
        // Extended Logic: Allow marking for last 3 days (for retrospective cleanup)
        const today = new Date().toISOString().split('T')[0];
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 3);
        const minDate = pastDate.toISOString().split('T')[0];

        // Search: Appointments >= 3 days ago that are CHECKED-IN
        const { data: appointments, error } = await this.supabase
            .from('sakhi_clinic_appointments')
            .select(`
                id,
                appointment_date,
                start_time,
                status,
                patient_name_snapshot,
                doctor_name:doctor_name_snapshot,
                patient:sakhi_clinic_patients(name)
            `)
            .gte('appointment_date', minDate) // >= 3 days ago
            .lte('appointment_date', today)   // <= Today
            .ilike('patient_name_snapshot', `%${nameHint}%`);

        if (error) throw error;

        // Filter: We ideally only show "Checked-In" ones, but user might select one that is just Scheduled
        // and we should error then. But to be helpful, let's show what we found.
        // UI Action will fail if status is wrong.

        const results = appointments?.map((appt: any) => ({
            id: appt.id,
            patientName: appt.patient_name_snapshot || appt.patient?.name,
            time: appt.start_time,
            doctorName: appt.doctor_name,
            currentStatus: appt.status
        })) || [];

        return results;
    }

    static async execute(appointmentId: string, userId: string, role: Role | string) {
        // 1. Fetch current status
        const { data: appt, error: fetchError } = await this.supabase
            .from('sakhi_clinic_appointments')
            .select('status, patient_name_snapshot, start_time, doctor_name_snapshot, sakhi_clinic_patients(name)')
            .eq('id', appointmentId)
            .single();

        if (fetchError || !appt) {
            throw new Error('Appointment not found.');
        }

        const patientData = Array.isArray(appt.sakhi_clinic_patients)
            ? appt.sakhi_clinic_patients[0]
            : appt.sakhi_clinic_patients;

        const patientName = patientData?.name || appt.patient_name_snapshot || 'Patient';

        // 2. Validation / Idempotency
        if (appt.status === 'Completed') {
            return {
                success: false,
                message: `Appointment for ${patientName} is already completed.`
            };
        }

        if (appt.status !== 'Checked-In') {
            return {
                success: false,
                message: `Cannot complete appointment. Patient status is currently "${appt.status}", but must be "Checked-In".`
            };
        }

        // 3. Update Status
        const { error: updateError } = await this.supabase
            .from('sakhi_clinic_appointments')
            .update({
                status: 'Completed',
                updated_at: new Date().toISOString()
            })
            .eq('id', appointmentId);

        if (updateError) throw updateError;

        // 4. Audit Log
        await AuditLogger.log({
            userId,
            role,
            action: 'MARK_APPOINTMENT_COMPLETED',
            targetId: appointmentId,
            details: { previousStatus: appt.status, newStatus: 'Completed' }
        });

        return {
            success: true,
            message: `Appointment for ${patientName} has been marked as Completed.`
        };
    }
}
