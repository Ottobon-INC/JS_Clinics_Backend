import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sanitizePayload } from '@/lib/utils';

export async function GET(_: Request, context: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const { id } = context.params;

  try {
    const { data, error } = await supabase
      .from('sakhi_clinical_notes')
      .select('*')
      .eq('patient_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error(`GET /api/patients/${context.params.id}/notes`, error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const { id } = context.params;

  try {
    const body = await request.json();
    const { doctor_id } = body;
    if (!doctor_id) {
      return NextResponse.json(
        { success: false, error: 'doctor_id is required' },
        { status: 400 }
      );
    }

    const payload = sanitizePayload({
      patient_id: id,
      doctor_id,
      appointment_id: body.appointment_id,
      subjective: body.subjective,
      objective: body.objective,
      assessment: body.assessment,
      plan: body.plan,
    });

    const { data, error } = await supabase
      .from('sakhi_clinical_notes')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error(`POST /api/patients/${context.params.id}/notes`, error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
