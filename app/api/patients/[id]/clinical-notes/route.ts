import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sanitizePayload } from '@/lib/utils';

function isUuid(value: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value
  );
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(_: Request, context: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const { id } = context.params;

  if (!isUuid(id)) {
    return NextResponse.json(
      { success: false, error: 'Invalid patient id' },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const { data, error } = await supabase
      .from('sakhi_clinic_patient_notes')
      .select('id, patient_id, doctor_id, note, created_at')
      .eq('patient_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] }, { headers: corsHeaders });
  } catch (error: any) {
    console.error(`GET /api/patients/${id}/clinical-notes`, error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: Request, context: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const { id } = context.params;

  if (!isUuid(id)) {
    return NextResponse.json(
      { success: false, error: 'Invalid patient id' },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const note = body?.note;
    const doctor_id = body?.doctor_id;

    if (!note) {
      return NextResponse.json(
        { success: false, error: 'note is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const payload = sanitizePayload({
      patient_id: id,
      doctor_id: isUuid(doctor_id) ? doctor_id : null,
      note,
    });

    const { data, error } = await supabase
      .from('sakhi_clinic_patient_notes')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { headers: corsHeaders });
  } catch (error: any) {
    console.error(`POST /api/patients/${context.params.id}/clinical-notes`, error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
