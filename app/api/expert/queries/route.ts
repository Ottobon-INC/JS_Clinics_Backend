import { NextResponse } from 'next/server';
import { ExpertService } from '@/lib/services/expert';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET() {
  try {
    const data = await ExpertService.getQueries();

    return NextResponse.json({
      success: true,
      data: data,
    }, { headers: corsHeaders });
    
  } catch (error: any) {
    console.error('GET /api/expert/queries', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
