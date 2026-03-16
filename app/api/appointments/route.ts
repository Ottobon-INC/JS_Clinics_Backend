import { NextResponse } from 'next/server';
import { AppointmentsService, GetAppointmentsParams } from '@/lib/services/appointments';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  const { searchParams } = new URL(request.url);

  try {
    const params: GetAppointmentsParams = {
      page: Number(searchParams.get('page') || '1'),
      limit: Number(searchParams.get('limit') || '20'),
      date: searchParams.get('date'),
      doctorId: searchParams.get('doctor_id'),
      status: searchParams.get('status'),
      mobile: searchParams.get('mobile'),
    };

    const result = await AppointmentsService.getAppointments(params);

    return NextResponse.json({
      success: true,
      data: result,
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('GET /api/appointments', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await AppointmentsService.createAppointment(body);

    return NextResponse.json({ success: true, data }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('POST /api/appointments', error);

    // Map common errors to HTTP status codes
    if (error.message === 'patient_id or lead_id is required' || error.message === 'Invalid patient id') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400, headers: corsHeaders }
      );
    }
    if (error.message === 'Patient not found') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
