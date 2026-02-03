import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sign } from 'jsonwebtoken';
import { verify } from 'password-hash';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';
const JWT_EXPIRES_IN = '7d';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { success: false, error: 'Email and password are required' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // 1. Find user by email
        const { data: user, error } = await supabase
            .from('sakhi_clinic_users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return NextResponse.json(
                { success: false, error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // 2. Verify password
        // NOTE: This assumes the 'password' column exists and stores a HASHED password.
        // If you are storing plain text passwords (NOT RECOMMENDED), use: if (user.password !== password)
        // For now, we try proper hash verification, but fallback to plain text check if hash fails 
        // (in case user manually entered plain text in DB).
        let isMatch = false;

        // Check if password field exists
        if (!user.password_hash) {
            return NextResponse.json(
                { success: false, error: 'User has no password set. Please contact admin.' },
                { status: 401 }
            );
        }

        if (verify(password, user.password_hash)) {
            isMatch = true;
        } else if (user.password_hash === password) {
            // Fallback for plain text (dev only)
            isMatch = true;
        }

        if (!isMatch) {
            return NextResponse.json(
                { success: false, error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // 3. Generate JWT
        const token = sign(
            {
                sub: user.id,
                email: user.email,
                role: user.role,
                name: user.name
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // 4. Return success with token and user info
        // Flattened structure to ensure frontend can find 'user' and 'token' easily
        return NextResponse.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                token
            },
            data: { // Keeping 'data' for backward compatibility if needed
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    token
                }
            }
        });

    } catch (error: any) {
        console.error('Login error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
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
