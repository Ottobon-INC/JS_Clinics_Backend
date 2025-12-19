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

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(_: Request, context: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const { id } = context.params;

  if (!isUuid(id)) {
    return NextResponse.json(
      { success: false, error: 'Invalid lead id' },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const payload = sanitizePayload({
      status: 'Follow Up', // map to an existing enum value
    });

    const { data, error } = await supabase
      .from('sakhi_clinic_leads')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Lead not found' },
          { status: 404, headers: corsHeaders }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data }, { headers: corsHeaders });
  } catch (error: any) {
    console.error(`POST /api/leads/${context.params.id}/re-engage`, error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
