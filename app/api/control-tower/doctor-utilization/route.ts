import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { AnalyticsService } from '@/lib/services/analytics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    const { error: authError } = await validateSession(request);
    if (authError) return authError;

    try {
        const result = await AnalyticsService.getDoctorUtilization();
        return NextResponse.json(result);

    } catch (error: any) {
        console.error('GET /api/control-tower/doctor-utilization', error);
        return NextResponse.json(
            { error: error?.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
