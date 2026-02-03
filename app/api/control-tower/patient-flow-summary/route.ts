
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
      .select('status')
      .eq('appointment_date', today);

    if (error) throw error;

    const counts = (appointments || []).reduce<Record<string, number>>((acc, curr) => {
      const status = curr.status || 'Scheduled'; // Default to Scheduled if null
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Ensure strict keys as per requirement if needed, or just return dynamic
    // Requirement says: { "scheduled": number, "arrived": number, ... }
    // We will normalize keys to lowercase for the response to match requirement example style
    // But the values in DB are likely Capitalized.

    // Let's create a normalized response object
    const responseData = {
      scheduled: (counts['Scheduled'] || 0) + (counts['Rescheduled'] || 0),
      arrived: counts['Arrived'] || 0,
      checkedIn: counts['Checked In'] || counts['Checked-In'] || 0,
      completed: counts['Completed'] || 0,
      cancelled: counts['Cancelled'] || 0, // Extra helpful
      noShow: counts['No Show'] || 0        // Extra helpful
    };

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('GET /api/control-tower/patient-flow-summary', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
