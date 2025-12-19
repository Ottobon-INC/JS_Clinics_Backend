import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isUuid(value: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value
  );
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

const BUCKET = 'patient-documents';

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(_: Request, context: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const patientId = context.params.id;

  if (!isUuid(patientId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid patient id' },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const { data, error } = await supabase
      .from('sakhi_clinic_documents')
      .select('*')
      .eq('patient_id', patientId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] }, { headers: corsHeaders });
  } catch (error: any) {
    console.error(`GET /api/patients/${patientId}/documents`, error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: Request, context: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const patientId = context.params.id;

  if (!isUuid(patientId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid patient id' },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const name = body?.name || body?.filename;
    const contentType = body?.contentType || 'application/octet-stream';
    const document_type = body?.document_type || body?.type;
    const base64 = body?.base64;
    const urlFromClient = body?.url;

    if (!name || !document_type) {
      return NextResponse.json(
        { success: false, error: 'Document name and document_type are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    let fileUrl = urlFromClient || '';
    let path = '';

    if (base64) {
      const fileBuffer = Buffer.from(base64, 'base64');
      const safeName = name.replace(/\s+/g, '_');
      path = `${patientId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, fileBuffer, { contentType, upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      fileUrl = publicUrlData?.publicUrl || fileUrl;
    }

    if (!fileUrl) {
      return NextResponse.json(
        { success: false, error: 'Document url or base64 content is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { data, error } = await supabase
      .from('sakhi_clinic_documents')
      .insert({
        patient_id: patientId,
        name,
        document_type,
        url: fileUrl,
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { headers: corsHeaders });
  } catch (error: any) {
    console.error(`POST /api/patients/${context.params.id}/documents`, error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
