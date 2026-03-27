import { NextResponse } from 'next/server';
import { ExpertService } from '@/lib/services/expert';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    
    // Basic Validation
    if (!rawBody.query_id || !rawBody.answer || !rawBody.category) {
        return NextResponse.json(
            { success: false, error: 'query_id, answer, and category are required' },
            { status: 400, headers: corsHeaders }
        );
    }
    
    if (!rawBody.category.course || !rawBody.category.module || !rawBody.category.topic || !rawBody.category.section) {
        return NextResponse.json(
            { success: false, error: 'Categorization requires course, module, topic, and section' },
            { status: 400, headers: corsHeaders }
        );
    }

    const data = await ExpertService.submitAnswer(rawBody);

    return NextResponse.json({ success: true, data }, { headers: corsHeaders });
    
  } catch (error: any) {
    console.error('POST /api/expert/answer', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
