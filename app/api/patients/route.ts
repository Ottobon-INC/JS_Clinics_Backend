import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateUhid, sanitizePayload } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');
  const q = searchParams.get('q');
  const page = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '20');
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    let query = supabase.from('sakhi_clinic_patients').select('*', { count: 'exact' });

    if (phone) {
      query = query.eq('mobile', phone);
    } else if (q) {
      query = query.or(`name.ilike.%${q}%,mobile.ilike.%${q}%`);
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data ?? [],
      pagination: { page, limit, total: count ?? data?.length ?? 0 },
    });
  } catch (error: any) {
    console.error('GET /api/patients', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();

  const toValue = (val: any) => {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'string' && val.trim() === '') return undefined;
    return val;
  };

  try {
    const body = await request.json();
    const name = toValue(body?.name);
    const mobile = toValue(body?.mobile) ?? toValue(body?.phone);
    const street = toValue(body?.street) ?? toValue(body?.address);
    const marital_status = toValue(body?.marital_status) ?? toValue(body?.maritalStatus) ?? 'Married';
    const registration_date =
      toValue(body?.registration_date) || toValue(body?.date) || new Date().toISOString().slice(0, 10);
    const gender = toValue(body?.gender) || 'Female';
    const dob = toValue(body?.dob);
    const age = toValue(body?.age);
    const aadhar = toValue(body?.aadhar);
    const blood_group = toValue(body?.blood_group) ?? toValue(body?.bloodGroup);
    const email = toValue(body?.email);
    const postal_code = toValue(body?.postal_code) ?? toValue(body?.postalCode);
    const referral_doctor = toValue(body?.referral_doctor) ?? toValue(body?.referralDoctor);
    const hospital_address = toValue(body?.hospital_address) ?? toValue(body?.hospitalAddress);
    const relation = toValue(body?.relation);
    const uhidInput = toValue(body?.uhid);
    const house = toValue(body?.house);
    const area = toValue(body?.area);
    const city = toValue(body?.city);
    const district = toValue(body?.district);
    const state = toValue(body?.state);

    if (!name || !mobile) {
      return NextResponse.json(
        { success: false, error: 'name and mobile (or phone) are required' },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from('sakhi_clinic_patients')
      .select('id')
      .eq('mobile', mobile)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      throw existingError;
    }
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Patient with this mobile already exists' },
        { status: 409 }
      );
    }

    const uhid = uhidInput || (await generateUhid(supabase));

    const payload = sanitizePayload({
      uhid,
      lead_id: toValue(body.lead_id),
      name,
      relation,
      marital_status,
      gender,
      dob,
      age,
      blood_group,
      aadhar,
      mobile,
      email,
      house,
      street,
      area,
      city,
      district,
      state,
      postal_code,
      emergency_contact_name: toValue(body.emergency_contact_name),
      emergency_contact_phone: toValue(body.emergency_contact_phone),
      emergency_contact_relation: toValue(body.emergency_contact_relation),
      assigned_doctor_id: toValue(body.assigned_doctor_id),
      referral_doctor,
      hospital_address,
      registration_date,
      status: toValue(body.status),
    });

    const { data, error } = await supabase
      .from('sakhi_clinic_patients')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('POST /api/patients', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
