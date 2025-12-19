import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_: Request, context: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const { id } = context.params;

  try {
    const { data, error } = await supabase
      .from('sakhi_clinic_appointments')
      .select('*')
      .eq('patient_id', id)
      .order('appointment_date', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error(`GET /api/patients/${context.params.id}/appointments`, error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
