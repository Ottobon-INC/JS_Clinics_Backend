import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function validateSession(request: Request) {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
        return {
            error: NextResponse.json(
                { success: false, error: 'Missing Authorization header' },
                { status: 401 }
            )
        };
    }

    const token = authHeader.replace('Bearer ', '');
    // const supabase = getSupabaseAdmin(); // No longer needed for session check

    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';

        // Dynamic import to avoid build-time issues if possible, though standard import is fine usually.
        // We use 'require' here or just standard import. Assuming 'jsonwebtoken' is installed.
        const jwt = require('jsonwebtoken'); // Using require to ensure we use the installed commonjs module

        const decoded = jwt.verify(token, JWT_SECRET);

        // Return user structure similar to what Supabase would return, 
        // to ensure compatibility with existing code that expects { user: { id... } }
        return {
            user: {
                id: decoded.sub,
                email: decoded.email,
                role: decoded.role,
                ...decoded
            }
        };

    } catch (err) {
        console.error('Token validation failed:', err);
        return {
            error: NextResponse.json(
                { success: false, error: 'Invalid or expired token' },
                { status: 401 }
            )
        };
    }
}
