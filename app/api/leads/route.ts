import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sanitizePayload } from '@/lib/utils';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '20');
  const phone = searchParams.get('phone');
  const status = searchParams.get('status');
  const q = searchParams.get('q');
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    let query = supabase
      .from('sakhi_clinic_leads')
      .select('*', { count: 'exact' })
      .order('date_added', { ascending: false })
      .range(from, to);

    if (phone) {
      query = query.eq('phone', phone);
    } else if (status) {
      query = query.eq('status', status);
    } else if (q) {
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        items: data ?? [],
        pagination: {
          page,
          limit,
          total: count ?? data?.length ?? 0,
        },
      },
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('GET /api/leads', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();

  try {
    const toValue = (val: any) => {
      if (val === undefined || val === null) return undefined;
      if (typeof val === 'string' && val.trim() === '') return undefined;
      return val;
    };

    const body = await request.json();
    const name = toValue(body.name);
    const phone = toValue(body.phone);
    const status = toValue(body.status);
    const date_added = toValue(body.date_added) ?? toValue(body.dateAdded);
    const age = toValue(body.age);
    const gender = toValue(body.gender);
    const source = toValue(body.source);
    const inquiry = toValue(body.inquiry);
    const problem = toValue(body.problem);
    const treatment_doctor = toValue(body.treatment_doctor) ?? toValue(body.treatmentDoctor);
    const treatment_suggested =
      toValue(body.treatment_suggested) ?? toValue(body.treatmentSuggested);
    const assigned_to_user_id =
      toValue(body.assigned_to_user_id) ?? toValue(body.assignedToUserId);

    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: 'name and phone are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const payload = sanitizePayload({
      name,
      phone,
      date_added,
      status,
      age,
      gender,
      source,
      inquiry,
      problem,
      treatment_doctor,
      treatment_suggested,
      assigned_to_user_id,
    });

    const { data, error } = await supabase
      .from('sakhi_clinic_leads')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('POST /api/leads', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
