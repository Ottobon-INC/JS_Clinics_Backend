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
    const supabase = getSupabaseAdmin();

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return {
            error: NextResponse.json(
                { success: false, error: 'Invalid or expired token' },
                { status: 401 }
            )
        };
    }

    return { user };
}
