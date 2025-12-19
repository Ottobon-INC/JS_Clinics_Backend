import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { backfillPatientSnapshot, sanitizePayload } from '@/lib/utils';

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
    return NextResponse.json(
      { success: false, error: 'Invalid appointment id', code: 'INVALID_APPOINTMENT_ID' },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const { data, error } = await supabase
      .from('sakhi_clinic_appointments')
      .select(`
        id,
        patient_id,
        lead_id,
        doctor_id,
        appointment_date,
        start_time,
        end_time,
        type,
        status,
        visit_reason,
        resource_id,
        doctor_name_snapshot,
        cancellation_reason,
        cancelled_at,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .single();

    if (error?.code === 'PGRST116' || !data) {
      return NextResponse.json(
        { success: false, error: 'Appointment not found', code: 'APPOINTMENT_NOT_FOUND' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { headers: corsHeaders });
  } catch (error: any) {
    console.error(`GET /api/appointments/${context.params.id}`, error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const { id } = context.params;

  if (!isUuid(id)) {
    return NextResponse.json(
      { success: false, error: 'Invalid appointment id', code: 'INVALID_APPOINTMENT_ID' },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));

    const { data: appointment, error: appointmentError } = await supabase
      .from('sakhi_clinic_appointments')
      .select('status')
      .eq('id', id)
      .single();

    if (appointmentError?.code === 'PGRST116' || !appointment) {
      return NextResponse.json(
        { success: false, error: 'Appointment not found', code: 'APPOINTMENT_NOT_FOUND' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (appointmentError) throw appointmentError;

    if (appointment.status === 'Completed') {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot update a completed appointment',
          code: 'STATUS_IMMUTABLE_COMPLETED',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    let validatedDoctorId = body?.doctor_id;
    if (body?.doctor_id !== undefined) {
      if (!isUuid(body.doctor_id)) {
        // If non-UUID is sent, skip updating doctor_id to avoid hard failure
        validatedDoctorId = undefined;
      } else {
        const { data: doctor, error: doctorError } = await supabase
          .from('sakhi_clinic_users')
          .select('id')
          .eq('id', body.doctor_id)
          .single();

        if (doctorError?.code === 'PGRST116' || !doctor) {
          return NextResponse.json(
            { success: false, error: 'Doctor not found', code: 'DOCTOR_NOT_FOUND' },
            { status: 404, headers: corsHeaders }
          );
        }

        if (doctorError) throw doctorError;
      }
    }

    // Allowed fields for rescheduling/editing only
    const startTime = body.appointment_time ?? body.start_time;
    const endTime = body.end_time ?? startTime;
    const allowed = sanitizePayload({
      appointment_date: body.appointment_date,
      start_time: startTime,
      end_time: endTime,
      doctor_id: validatedDoctorId,
      notes: body.notes,
    });

    const { data, error } = await supabase
      .from('sakhi_clinic_appointments')
      .update(allowed)
      .eq('id', id)
      .select()
      .single();

    if (error?.code === 'PGRST116') {
      return NextResponse.json(
        { success: false, error: 'Appointment not found', code: 'APPOINTMENT_NOT_FOUND' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (error) throw error;

    await backfillPatientSnapshot(supabase, id);

    return NextResponse.json({ success: true, data }, { headers: corsHeaders });
  } catch (error: any) {
    console.error(`PATCH /api/appointments/${context.params.id}`, error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
