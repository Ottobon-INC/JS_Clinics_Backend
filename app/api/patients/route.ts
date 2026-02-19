import { NextResponse } from 'next/server';
import { PatientsService, GetPatientsParams } from '@/lib/services/patients';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const params: GetPatientsParams = {
      page: Number(searchParams.get('page') || '1'),
      limit: Number(searchParams.get('limit') || '20'),
      phone: searchParams.get('phone'),
      q: searchParams.get('q'),
    };

    const result = await PatientsService.getPatients(params);

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error: any) {
    console.error('GET /api/patients', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await PatientsService.createPatient(body);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('POST /api/patients', error);

    if (error.message === 'name and mobile (or phone) are required') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    if (error.message === 'Patient with this mobile already exists') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
