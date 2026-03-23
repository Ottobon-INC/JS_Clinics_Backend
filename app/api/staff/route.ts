import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { StaffService, GetStaffParams } from '@/lib/services/staff';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: corsHeaders });
}

/**
 * GET /api/staff — List staff with optional filters
 * Query params: role, specialty, department, is_active, location, category, q, page, limit
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    try {
        const isActiveParam = searchParams.get('is_active');

        const params: GetStaffParams = {
            page: Number(searchParams.get('page') || '1'),
            limit: Number(searchParams.get('limit') || '50'),
            role: searchParams.get('role') as any,
            specialty: searchParams.get('specialty'),
            department: searchParams.get('department'),
            is_active: isActiveParam !== null ? isActiveParam === 'true' : null,
            location: searchParams.get('location'),
            category: searchParams.get('category'),
            q: searchParams.get('q'),
        };

        const result = await StaffService.getStaff(params);

        return NextResponse.json(
            { success: true, data: result },
            { headers: corsHeaders }
        );
    } catch (error: any) {
        console.error('GET /api/staff', error);
        return NextResponse.json(
            { success: false, error: error?.message || 'Internal Server Error' },
            { status: 500, headers: corsHeaders }
        );
    }
}

/**
 * POST /api/staff — Create a new staff member (Admin only)
 */
export async function POST(request: Request) {
    // Auth check — Admin only
    const session = await validateSession(request);
    if (session.error) return session.error;

    if (session.user?.role !== 'admin' && session.user?.role !== 'Admin') {
        return NextResponse.json(
            { success: false, error: 'Only admin users can create staff members' },
            { status: 403, headers: corsHeaders }
        );
    }

    try {
        const body = await request.json();
        const data = await StaffService.createStaff(body);

        return NextResponse.json(
            { success: true, data },
            { status: 201, headers: corsHeaders }
        );
    } catch (error: any) {
        console.error('POST /api/staff', error);

        const status = error.message?.includes('required') || error.message?.includes('Invalid')
            ? 400
            : error.message?.includes('not found')
                ? 404
                : 500;

        return NextResponse.json(
            { success: false, error: error?.message || 'Internal Server Error' },
            { status, headers: corsHeaders }
        );
    }
}
