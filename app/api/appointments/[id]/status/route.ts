import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sanitizePayload } from '@/lib/utils';

function isUuid(value: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value
  );
}

const allowedStatuses = ['Scheduled', 'Arrived', 'Checked-In', 'Completed', 'Canceled', 'Expected'];

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
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
    const status = body?.status;

    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status value', code: 'INVALID_STATUS' },
        { status: 400, headers: corsHeaders }
      );
    }

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

    const timestamp = new Date().toISOString();
    const cancellationReason = body?.cancellation_reason ?? body?.reason ?? 'Cancelled by frontdesk';

    const payload = sanitizePayload({
      status,
      cancellation_reason: status === 'Canceled' ? cancellationReason : undefined,
      cancelled_at: status === 'Canceled' ? timestamp : undefined,
      arrived_at: status === 'Arrived' ? timestamp : undefined,
      checked_in_at: status === 'Checked-In' ? timestamp : undefined,
      completed_at: status === 'Completed' ? timestamp : undefined,
    });

    const { data, error } = await supabase
      .from('sakhi_clinic_appointments')
      .update(payload)
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

    return NextResponse.json({ success: true, data }, { headers: corsHeaders });
  } catch (error: any) {
    console.error(`PATCH /api/appointments/${context.params.id}/status`, error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
