import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json().catch(() => ({}));
    const email = body?.email;
    const password = body?.password;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { data, error } = await supabase
      .from('sakhi_clinic_users')
      .select('id, email, role')
      .eq('email', email)
      .eq('password_hash', password)
      .maybeSingle();

    if (error) {
      console.error('POST /api/auth/login', error);
      return NextResponse.json(
        { success: false, error: error.message || 'Internal Server Error' },
        { status: 500, headers: corsHeaders }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Login successful',
        user: {
          id: data.id,
          email: data.email,
          role: data.role,
        },
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('POST /api/auth/login', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
