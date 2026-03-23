import { NextResponse } from 'next/server';
import { StaffService } from '@/lib/services/staff';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: corsHeaders });
}

/**
 * GET /api/staff/:id/availability?date=YYYY-MM-DD
 * Returns scheduled slots + booked appointments for the given date
 */
export async function GET(_: Request, context: { params: { id: string } }) {
    const { id } = context.params;
    const url = new URL(_.url);
    const date = url.searchParams.get('date');

    if (!date) {
        return NextResponse.json(
            { success: false, error: 'date query parameter is required (YYYY-MM-DD)' },
            { status: 400, headers: corsHeaders }
        );
    }

    try {
        const data = await StaffService.checkAvailability(id, date);

        return NextResponse.json(
            { success: true, data },
            { headers: corsHeaders }
        );
    } catch (error: any) {
        console.error(`GET /api/staff/${id}/availability`, error);

        const status = error.message?.includes('Invalid') ? 400
            : error.message?.includes('not found') ? 404
                : 500;

        return NextResponse.json(
            { success: false, error: error?.message || 'Internal Server Error' },
            { status, headers: corsHeaders }
        );
    }
}
