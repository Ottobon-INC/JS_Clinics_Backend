
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
        doctor_id,
        doctor_name_snapshot
      `)
            .eq('appointment_date', today);

        if (error) throw error;

        const statsByDoctor: Record<string, { total: number; completed: number; pending: number; name: string }> = {};

        (appointments || []).forEach((appt: any) => {
            // Use name snapshot or relation or ID as fallback
            const doctorName = appt.doctor_name_snapshot || 'Unassigned';

            // We can group by doctor Name for display, or doctor ID. 
            // Requirement asks for list of objects with doctorName. 
            // Keying by name might merge two doctors with same name, but less likely in small clinic.
            // Better to key by ID if available, but for unassigned we group them.
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

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('GET /api/control-tower/doctor-utilization', error);
        return NextResponse.json(
            { error: error?.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
