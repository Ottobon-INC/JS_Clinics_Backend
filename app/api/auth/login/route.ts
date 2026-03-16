import { NextResponse } from 'next/server';
import { AuthService } from '@/lib/services/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body;

        const result = await AuthService.login(email, password);

        return NextResponse.json({
            success: true,
            ...result,
            data: result // Keeping 'data' for backward compatibility
        });

    } catch (error: any) {
        console.error('Login error:', error);

        let status = 500;
        if (error.message === 'Email and password are required') status = 400;
        if (error.message === 'Invalid credentials' || error.message.includes('User has no password')) status = 401;

        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
