import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
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
  const perPage = Number(searchParams.get('perPage') || searchParams.get('limit') || '100');
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  try {
    const { data, error, count } = await supabase
      .from('sakhi_knowledge_hub')
      .select('*', { count: 'exact' })
      .order('published_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const articles =
      data?.map((row: any) => ({
        ...row,
        summary: row.summary ?? row.content_summary ?? null,
        content: row.content ?? row.body ?? null,
      })) ?? [];

    return NextResponse.json(
      {
        success: true,
        data: articles,
        pagination: {
          page,
          perPage,
          total: count ?? articles.length ?? 0,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('GET /api/knowledge/articles', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
