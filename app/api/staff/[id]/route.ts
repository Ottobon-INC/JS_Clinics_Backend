import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { StaffService } from '@/lib/services/staff';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: corsHeaders });
}

/**
 * GET /api/staff/:id — Get a single staff member
 */
export async function GET(_: Request, context: { params: { id: string } }) {
    const { id } = context.params;

    try {
        const data = await StaffService.getStaffById(id);

        return NextResponse.json(
            { success: true, data },
            { headers: corsHeaders }
        );
    } catch (error: any) {
        console.error(`GET /api/staff/${id}`, error);

        const status = error.message?.includes('Invalid') ? 400
            : error.message?.includes('not found') ? 404
                : 500;

        return NextResponse.json(
            { success: false, error: error?.message || 'Internal Server Error' },
            { status, headers: corsHeaders }
        );
    }
}

/**
 * PATCH /api/staff/:id — Update a staff member (Admin only)
 */
export async function PATCH(request: Request, context: { params: { id: string } }) {
    const { id } = context.params;

    // Auth check — Admin only
    const session = await validateSession(request);
    if (session.error) return session.error;

    if (session.user?.role !== 'admin' && session.user?.role !== 'Admin') {
        return NextResponse.json(
            { success: false, error: 'Only admin users can update staff members' },
            { status: 403, headers: corsHeaders }
        );
    }

    try {
        const body = await request.json().catch(() => ({}));
        const data = await StaffService.updateStaff(id, body);

        return NextResponse.json(
            { success: true, data },
            { headers: corsHeaders }
        );
    } catch (error: any) {
        console.error(`PATCH /api/staff/${id}`, error);

        const status = error.message?.includes('Invalid') || error.message?.includes('No valid')
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

/**
 * DELETE /api/staff/:id — Soft-deactivate a staff member (Admin only)
 */
export async function DELETE(request: Request, context: { params: { id: string } }) {
    const { id } = context.params;

    // Auth check — Admin only
    const session = await validateSession(request);
    if (session.error) return session.error;

    if (session.user?.role !== 'admin' && session.user?.role !== 'Admin') {
        return NextResponse.json(
            { success: false, error: 'Only admin users can deactivate staff members' },
            { status: 403, headers: corsHeaders }
        );
    }

    try {
        const data = await StaffService.deactivateStaff(id);

        return NextResponse.json(
            { success: true, data, message: 'Staff member deactivated' },
            { headers: corsHeaders }
        );
    } catch (error: any) {
        console.error(`DELETE /api/staff/${id}`, error);

        const status = error.message?.includes('Invalid') ? 400
            : error.message?.includes('not found') ? 404
                : error.message?.includes('already deactivated') ? 409
                    : 500;

        return NextResponse.json(
            { success: false, error: error?.message || 'Internal Server Error' },
            { status, headers: corsHeaders }
        );
    }
}
