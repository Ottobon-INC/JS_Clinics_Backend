import { getSupabaseAdmin } from '@/lib/supabase';
import { sign } from 'jsonwebtoken';
import { verify } from 'password-hash';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';
const JWT_EXPIRES_IN = '7d';

export class AuthService {
    static async login(email: string, password: string) {
        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        const supabase = getSupabaseAdmin();

        // 1. Find user by email
        const { data: user, error } = await supabase
            .from('sakhi_clinic_users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            throw new Error('Invalid credentials');
        }

        // 2. Verify password
        let isMatch = false;

        // Check if password field exists
        if (!user.password_hash) {
            throw new Error('User has no password set. Please contact admin.');
        }

        if (verify(password, user.password_hash)) {
            isMatch = true;
        } else if (user.password_hash === password) {
            // Fallback for plain text (dev only)
            isMatch = true;
        }

        if (!isMatch) {
            console.log('Login Failed: Password mismatch', {
                hasHash: !!user.password_hash,
                // Avoid logging actual password in production logs
                userId: user.id
            });
            throw new Error('Invalid credentials');
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
        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                token
            }
        };
    }
}
