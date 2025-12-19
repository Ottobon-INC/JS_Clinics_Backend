import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sanitizePayload } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isUuid(value: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
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
    return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400, headers: corsHeaders });
  }

  const { data, error } = await supabase
    .from('sakhi_clinic_leads')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404, headers: corsHeaders });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json({ success: true, data }, { headers: corsHeaders });
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const { id } = context.params;

  if (!isUuid(id)) {
    return NextResponse.json({ success: false, error: 'Invalid lead id' }, { status: 400, headers: corsHeaders });
  }

  try {
    const toValue = (val: any) => {
      if (val === undefined || val === null) return undefined;
      if (typeof val === 'string' && val.trim() === '') return undefined;
      return val;
    };

    const body = await request.json().catch(() => ({}));
    const statusRaw = toValue(body.status);
    const normalizedStatus = statusRaw === 'Contacted' ? 'Follow Up' : statusRaw;

    const updates = sanitizePayload({
      name: toValue(body.name),
      phone: toValue(body.phone),
      age: toValue(body.age),
      gender: toValue(body.gender),
      source: toValue(body.source),
      inquiry: toValue(body.inquiry),
      problem: toValue(body.problem),
      treatment_doctor: toValue(body.treatment_doctor) ?? toValue(body.treatmentDoctor),
      treatment_suggested: toValue(body.treatment_suggested) ?? toValue(body.treatmentSuggested),
      status: normalizedStatus,
      assigned_to_user_id: toValue(body.assigned_to_user_id) ?? toValue(body.assignedToUserId),
      date_added: toValue(body.date_added) ?? toValue(body.dateAdded),
    });

    if (!Object.keys(updates).length) {
      return NextResponse.json(
        { success: false, error: 'No fields provided to update' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { data, error } = await supabase
      .from('sakhi_clinic_leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404, headers: corsHeaders });
      }
      console.error(`PATCH /api/leads/${id}`, error);
      return NextResponse.json(
        { success: false, error: error.message || 'Internal Server Error', details: error.details },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({ success: true, data }, { headers: corsHeaders });
  } catch (error: any) {
    console.error(`PATCH /api/leads/${id}`, error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
