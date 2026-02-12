
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { validateSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    const { error: authError } = await validateSession(request);
    if (authError) return authError;

    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().split('T')[0];

    try {
        const { data: appointments, error } = await supabase
            .from('sakhi_clinic_appointments')
            .select(`
        id,
        status,
        updated_at,
        arrived_at,
        checked_in_at,
        created_at,
        patient_name_snapshot,
        doctor_name_snapshot,
        sakhi_clinic_patients (
          name
        )
      `)
            .eq('appointment_date', today)
            .in('status', ['Arrived', 'Checked-In']);
        // Only those who have physically arrived/checked-in are in the "live queue" waiting.

        if (error) throw error;

        const now = new Date();
        const liveQueue: any[] = [];

        (appointments || []).forEach((appt: any) => {
            const statusTime = new Date(appt.checked_in_at || appt.arrived_at || appt.updated_at);
            const diffMs = now.getTime() - statusTime.getTime();
            const waitingMinutes = Math.floor(diffMs / 60000);

            liveQueue.push({
                patientName: appt.patient_name_snapshot || appt.sakhi_clinic_patients?.name || 'Unknown',
                doctorName: appt.doctor_name_snapshot || 'Unassigned',
                status: appt.status,
                waitingMinutes
            });
        });

        // Sort by waiting time descending (longest wait first)
        liveQueue.sort((a, b) => b.waitingMinutes - a.waitingMinutes);

        return NextResponse.json(liveQueue);

    } catch (error: any) {
        console.error('GET /api/control-tower/live-queue', error);
        return NextResponse.json(
            { error: error?.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
