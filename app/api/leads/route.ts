import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { LeadsService, GetLeadsParams } from '@/lib/services/leads';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: Request) {
  const { error: authError } = await validateSession(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);

  try {
    const params: GetLeadsParams = {
      page: Number(searchParams.get('page') || '1'),
      limit: Number(searchParams.get('limit') || '20'),
      phone: searchParams.get('phone'),
      status: searchParams.get('status'),
      q: searchParams.get('q'),
    };

    const result = await LeadsService.getLeads(params);

    return NextResponse.json({
      success: true,
      data: result,
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
  const { error: authError } = await validateSession(request);
  if (authError) return authError;

  try {
    const rawBody = await request.json();
    const data = await LeadsService.createLead(rawBody);

    return NextResponse.json({ success: true, data }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('POST /api/leads', error);

    // Handle validation errors (e.g. missing name/phone) with 400
    if (error.message === 'name and phone are required') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
