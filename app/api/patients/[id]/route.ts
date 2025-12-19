import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sanitizePayload } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isUuid(value: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value
  );
}

export async function GET(_: Request, context: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const { id } = context.params;

  if (!isUuid(id)) {
    return NextResponse.json({ success: false, error: 'Invalid patient id' }, { status: 400 });
  }

  try {
    const { data: patient, error: patientError } = await supabase
      .from('sakhi_clinic_patients')
      .select('*')
      .eq('id', id)
      .single();

    if (patientError) {
      if (patientError.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
      }
      throw patientError;
    }
    if (!patient) {
      return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: patient });
  } catch (error: any) {
    console.error(`GET /api/patients/${context.params.id}`, error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const { id } = context.params;

  try {
    const toValue = (val: any) => {
      if (val === undefined || val === null) return undefined;
      if (typeof val === 'string' && val.trim() === '') return undefined;
      return val;
    };

    const body = await request.json();
    const mobile = toValue(body.mobile) ?? toValue(body.phone);
    if (mobile) {
      const { data: conflict, error: conflictError } = await supabase
        .from('sakhi_clinic_patients')
        .select('id')
        .eq('mobile', mobile)
        .neq('id', id)
        .maybeSingle();

      if (conflictError && conflictError.code !== 'PGRST116') {
        throw conflictError;
      }
      if (conflict) {
        return NextResponse.json(
          { success: false, error: 'Mobile number already exists' },
          { status: 409 }
        );
      }
    }

    const sanitized = sanitizePayload({
      lead_id: toValue(body.lead_id),
      name: toValue(body.name),
      mobile,
      relation: toValue(body.relation),
      marital_status: toValue(body.marital_status) ?? toValue(body.maritalStatus),
      gender: toValue(body.gender),
      dob: toValue(body.dob),
      age: toValue(body.age),
      blood_group: toValue(body.blood_group) ?? toValue(body.bloodGroup),
      aadhar: toValue(body.aadhar),
      email: toValue(body.email),
      house: toValue(body.house),
      street: toValue(body.street) ?? toValue(body.address),
      area: toValue(body.area),
      city: toValue(body.city),
      district: toValue(body.district),
      state: toValue(body.state),
      postal_code: toValue(body.postal_code) ?? toValue(body.postalCode),
      emergency_contact_name: toValue(body.emergency_contact_name),
      emergency_contact_phone: toValue(body.emergency_contact_phone),
      emergency_contact_relation: toValue(body.emergency_contact_relation),
      assigned_doctor_id: toValue(body.assigned_doctor_id),
      referral_doctor: toValue(body.referral_doctor) ?? toValue(body.referralDoctor),
      hospital_address: toValue(body.hospital_address) ?? toValue(body.hospitalAddress),
      registration_date: toValue(body.registration_date) ?? toValue(body.date),
      status: toValue(body.status),
    });
    delete (sanitized as any).id;
    delete (sanitized as any).uhid;
    delete (sanitized as any).created_at;

    const { data, error } = await supabase
      .from('sakhi_clinic_patients')
      .update(sanitized)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error(`PATCH /api/patients/${context.params.id}`, error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
