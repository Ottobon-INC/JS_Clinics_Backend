import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data: todayAppointments, error: apptErr } = await supabase
      .from('sakhi_clinic_appointments')
      .select('*')
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (apptErr) throw apptErr;

    const { data: recentLeads, error: leadsError } = await supabase
      .from('sakhi_clinic_leads')
      .select('*')
      .order('date_added', { ascending: false })
      .limit(5);

    if (leadsError) throw leadsError;

    const { data: leadStatuses, error: funnelError } = await supabase
      .from('sakhi_clinic_leads')
      .select('status');

    if (funnelError) throw funnelError;

    const funnelCounts = (leadStatuses || []).reduce<Record<string, number>>((acc, row) => {
      const key = row.status || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const leadFunnel = Object.entries(funnelCounts).map(([status, count]) => ({ status, count }));

    return NextResponse.json({
      success: true,
      data: { todayAppointments, recentLeads, leadFunnel },
    });
  } catch (error: any) {
    console.error('GET /api/dashboard/summary', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
