import { getSupabaseAdmin } from '@/lib/supabase';
import { AuditLogger } from '../audit-log';
import { Role } from '../types';

export class CheckInAction {
    private static supabase = getSupabaseAdmin();

    /**
     * Step 3: Search for patient to check in.
     * Scope: Today's appointments only.
     */
    static async search(nameHint: string) {
        const today = new Date().toISOString().split('T')[0];

        // 1. Search appointments for name match & today
        // Note: Using 'ilike' for case-insensitive partial match
        // Assuming we join with patients to search by name OR if name is snapshotted.
        // The data-fetcher showed 'patient_name_snapshot'. We'll use that for performance/simplicity or join.
        // Let's use the relation 'sakhi_clinic_patients.name' as primary search.

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
            .eq('appointment_date', today)
            .ilike('patient_name_snapshot', `%${nameHint}%`);

        if (error) throw error;

        // Filter out those that are already checked in? 
        // User might ask "Check in Anjali", if Anjali is already checked in, we should probably still show her
        // so the system can say "She is already checked in".
        // However, for the LIST to pick from, we usually want actionable ones.
        // Requirement says: "Determine result set". 
        // Let's return all matches, and let the orchestrator or UI decide, OR filter here.
        // Better UX: Show them, but maybe indicate status. 
        // For now, let's return all "Scheduled" ones primarily, or just return all and let logic handle it.
        // Correction: The requirement for Step 3 says "Possible outcomes: list for user selection".

        const results = appointments?.map((appt: any) => ({
            id: appt.id,
            patientName: appt.patient_name_snapshot || appt.patient?.name,
            time: appt.start_time,
            doctorName: appt.doctor_name,
            currentStatus: appt.status
        })) || [];

        return results;
    }

    /**
     * Step 6: Execute Check-in
     * Idempotent: Verify status first.
     */
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

        // Fix: Supabase might return joined relation as array
        const patientData = Array.isArray(appt.sakhi_clinic_patients)
            ? appt.sakhi_clinic_patients[0]
            : appt.sakhi_clinic_patients;

        const patientName = patientData?.name || appt.patient_name_snapshot || 'Patient';

        // 2. Idempotency Check
        if (appt.status === 'Checked-In' || appt.status === 'Arrived') { // "Arrived" is effectively checked-in contextually often, but stick to status
            return {
                success: false,
                message: `Patient ${patientName} is already checked in.`
            };
        }

        // 3. Update Status
        const { error: updateError } = await this.supabase
            .from('sakhi_clinic_appointments')
            .update({
                status: 'Checked-In',
                checked_in_at: new Date().toISOString(), // Important for wait time calc
                updated_at: new Date().toISOString()
            })
            .eq('id', appointmentId);

        if (updateError) throw updateError;

        // 4. Audit Log
        await AuditLogger.log({
            userId,
            role,
            action: 'CHECK_IN_PATIENT',
            targetId: appointmentId,
            details: { previousStatus: appt.status, newStatus: 'Checked-In' }
        });

        // 5. Final Response
        return {
            success: true,
            message: `Patient ${patientName} (${appt.start_time} with ${appt.doctor_name_snapshot}) has been checked in successfully.`
        };
    }
}
