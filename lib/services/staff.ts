import { getSupabaseAdmin } from '@/lib/supabase';
import { sanitizePayload } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export type StaffRole = 'doctor' | 'front_desk' | 'cro' | 'nurse' | 'admin';

export interface LeaveOverride {
    date: string;       // YYYY-MM-DD
    reason?: string;
}

export interface GetStaffParams {
    page?: number;
    limit?: number;
    role?: StaffRole | null;
    specialty?: string | null;
    department?: string | null;
    is_active?: boolean | null;
    location?: string | null;
    category?: string | null;
    q?: string | null;  // search by name
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isUuid(value: string) {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

const VALID_ROLES: StaffRole[] = ['doctor', 'front_desk', 'cro', 'nurse', 'admin'];
const VALID_SHIFTS = ['morning', 'evening', 'full_day', 'rotational'];
const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function validateTimeSlot(slot: string): boolean {
    // e.g., "09:00-13:00"
    const match = slot.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    if (!match) return false;
    return match[1] < match[2];
}

function validateAvailability(availability: any): boolean {
    if (!availability || typeof availability !== 'object') return true; // empty is ok
    for (const key of Object.keys(availability)) {
        if (!DAYS_OF_WEEK.includes(key)) return false;
        if (!Array.isArray(availability[key])) return false;
        for (const slot of availability[key]) {
            if (typeof slot !== 'string' || !validateTimeSlot(slot)) return false;
        }
    }
    return true;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class StaffService {
    /**
     * List staff with optional filters and pagination
     */
    static async getStaff(params: GetStaffParams) {
        const supabase = getSupabaseAdmin();
        const page = params.page || 1;
        const limit = params.limit || 50;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('sakhi_clinic_staff')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (params.role) {
            query = query.eq('role', params.role);
        }
        if (params.specialty) {
            query = query.ilike('specialty', `%${params.specialty}%`);
        }
        if (params.department) {
            query = query.ilike('department', `%${params.department}%`);
        }
        if (params.is_active !== null && params.is_active !== undefined) {
            query = query.eq('is_active', params.is_active);
        }
        if (params.location) {
            query = query.ilike('location', `%${params.location}%`);
        }
        if (params.category) {
            query = query.eq('category', params.category);
        }
        if (params.q) {
            query = query.ilike('name', `%${params.q}%`);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        return {
            items: data ?? [],
            pagination: {
                page,
                limit,
                total: count ?? data?.length ?? 0,
            },
        };
    }

    /**
     * Get a single staff member by ID
     */
    static async getStaffById(id: string) {
        if (!isUuid(id)) {
            throw new Error('Invalid staff ID');
        }

        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('sakhi_clinic_staff')
            .select('*')
            .eq('id', id)
            .single();

        if (error?.code === 'PGRST116' || !data) {
            throw new Error('Staff member not found');
        }
        if (error) throw error;

        return data;
    }

    /**
     * Create a new staff member
     */
    static async createStaff(body: any) {
        const supabase = getSupabaseAdmin();

        const name = body.name?.trim();
        const role = body.role?.trim()?.toLowerCase();

        if (!name) {
            throw new Error('Name is required');
        }
        if (!role || !VALID_ROLES.includes(role as StaffRole)) {
            throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
        }

        // Doctor-specific validation
        if (role === 'doctor' && !body.specialty?.trim()) {
            throw new Error('Specialty is required for doctors');
        }

        // Validate availability if provided
        if (body.availability && !validateAvailability(body.availability)) {
            throw new Error('Invalid availability format. Expected: { "monday": ["09:00-13:00"], ... }');
        }

        // Validate shift if provided
        if (body.shift && !VALID_SHIFTS.includes(body.shift)) {
            throw new Error(`Invalid shift. Must be one of: ${VALID_SHIFTS.join(', ')}`);
        }

        // Validate user_id if provided
        if (body.user_id) {
            if (!isUuid(body.user_id)) {
                throw new Error('Invalid user_id format');
            }
            // Check that user exists
            const { data: user, error: userErr } = await supabase
                .from('sakhi_clinic_users')
                .select('id')
                .eq('id', body.user_id)
                .maybeSingle();

            if (userErr && userErr.code !== 'PGRST116') throw userErr;
            if (!user) {
                throw new Error('Linked user account not found');
            }
        }

        // Validate leave_overrides if provided
        if (body.leave_overrides && Array.isArray(body.leave_overrides)) {
            for (const override of body.leave_overrides) {
                if (!override.date || !/^\d{4}-\d{2}-\d{2}$/.test(override.date)) {
                    throw new Error('Each leave override must have a valid date in YYYY-MM-DD format');
                }
            }
        }

        const payload = sanitizePayload({
            name,
            role,
            specialty: body.specialty?.trim(),
            department: body.department?.trim(),
            contact: body.contact || {},
            availability: body.availability || {},
            leave_overrides: body.leave_overrides || [],
            shift: body.shift,
            is_active: body.is_active !== undefined ? body.is_active : true,
            location: body.location?.trim(),
            category: body.category?.trim(),
            color: body.color?.trim(),
            user_id: body.user_id,
            notes: body.notes?.trim(),
        });

        const { data, error } = await supabase
            .from('sakhi_clinic_staff')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Update an existing staff member
     */
    static async updateStaff(id: string, body: any) {
        if (!isUuid(id)) {
            throw new Error('Invalid staff ID');
        }

        const supabase = getSupabaseAdmin();

        // Verify existence
        const { data: existing, error: existErr } = await supabase
            .from('sakhi_clinic_staff')
            .select('id, role')
            .eq('id', id)
            .single();

        if (existErr?.code === 'PGRST116' || !existing) {
            throw new Error('Staff member not found');
        }
        if (existErr) throw existErr;

        // Validate role if being updated
        if (body.role !== undefined) {
            if (!VALID_ROLES.includes(body.role)) {
                throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
            }
        }

        // Validate availability if provided
        if (body.availability !== undefined && !validateAvailability(body.availability)) {
            throw new Error('Invalid availability format');
        }

        // Validate shift if provided
        if (body.shift !== undefined && body.shift !== null && !VALID_SHIFTS.includes(body.shift)) {
            throw new Error(`Invalid shift. Must be one of: ${VALID_SHIFTS.join(', ')}`);
        }

        // Validate leave_overrides if provided
        if (body.leave_overrides !== undefined && Array.isArray(body.leave_overrides)) {
            for (const override of body.leave_overrides) {
                if (!override.date || !/^\d{4}-\d{2}-\d{2}$/.test(override.date)) {
                    throw new Error('Each leave override must have a valid date in YYYY-MM-DD format');
                }
            }
        }

        const allowed = sanitizePayload({
            name: body.name?.trim(),
            role: body.role,
            specialty: body.specialty?.trim(),
            department: body.department?.trim(),
            contact: body.contact,
            availability: body.availability,
            leave_overrides: body.leave_overrides,
            shift: body.shift,
            is_active: body.is_active,
            location: body.location?.trim(),
            category: body.category?.trim(),
            color: body.color?.trim(),
            user_id: body.user_id,
            notes: body.notes?.trim(),
        });

        if (!Object.keys(allowed).length) {
            throw new Error('No valid fields to update');
        }

        const { data, error } = await supabase
            .from('sakhi_clinic_staff')
            .update(allowed)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Soft-deactivate a staff member (set is_active = false)
     */
    static async deactivateStaff(id: string) {
        if (!isUuid(id)) {
            throw new Error('Invalid staff ID');
        }

        const supabase = getSupabaseAdmin();

        const { data: existing, error: existErr } = await supabase
            .from('sakhi_clinic_staff')
            .select('id, is_active')
            .eq('id', id)
            .single();

        if (existErr?.code === 'PGRST116' || !existing) {
            throw new Error('Staff member not found');
        }
        if (existErr) throw existErr;

        if (!existing.is_active) {
            throw new Error('Staff member is already deactivated');
        }

        const { data, error } = await supabase
            .from('sakhi_clinic_staff')
            .update({ is_active: false })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Check doctor availability for a given date.
     * Returns the doctor's scheduled slots for the day + already booked appointment times.
     */
    static async checkAvailability(staffId: string, date: string) {
        if (!isUuid(staffId)) {
            throw new Error('Invalid staff ID');
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error('Date must be in YYYY-MM-DD format');
        }

        const supabase = getSupabaseAdmin();

        // 1. Get staff member
        const { data: staff, error: staffErr } = await supabase
            .from('sakhi_clinic_staff')
            .select('id, name, role, availability, leave_overrides, is_active')
            .eq('id', staffId)
            .single();

        if (staffErr?.code === 'PGRST116' || !staff) {
            throw new Error('Staff member not found');
        }
        if (staffErr) throw staffErr;

        if (!staff.is_active) {
            return {
                staff_id: staffId,
                staff_name: staff.name,
                date,
                is_available: false,
                reason: 'Staff member is inactive',
                scheduled_slots: [],
                booked_slots: [],
            };
        }

        // 2. Check leave overrides
        const leaveOverrides: LeaveOverride[] = staff.leave_overrides || [];
        const isOnLeave = leaveOverrides.some((l: LeaveOverride) => l.date === date);

        if (isOnLeave) {
            const leaveEntry = leaveOverrides.find((l: LeaveOverride) => l.date === date);
            return {
                staff_id: staffId,
                staff_name: staff.name,
                date,
                is_available: false,
                reason: `On leave: ${leaveEntry?.reason || 'Scheduled leave'}`,
                scheduled_slots: [],
                booked_slots: [],
            };
        }

        // 3. Get day-of-week availability
        const dayOfWeek = new Date(date + 'T00:00:00')
            .toLocaleDateString('en-US', { weekday: 'long' })
            .toLowerCase();

        const availability = staff.availability || {};
        const scheduledSlots: string[] = availability[dayOfWeek] || [];

        if (scheduledSlots.length === 0) {
            return {
                staff_id: staffId,
                staff_name: staff.name,
                date,
                is_available: false,
                reason: `No scheduled availability on ${dayOfWeek}`,
                scheduled_slots: [],
                booked_slots: [],
            };
        }

        // 4. Get existing appointments for this doctor on this date
        const { data: appointments, error: apptErr } = await supabase
            .from('sakhi_clinic_appointments')
            .select('id, start_time, end_time, status, patient_name_snapshot')
            .eq('doctor_id', staffId)
            .eq('appointment_date', date)
            .not('status', 'eq', 'Canceled');

        if (apptErr) throw apptErr;

        const bookedSlots = (appointments || []).map((a: any) => ({
            id: a.id,
            start_time: a.start_time,
            end_time: a.end_time,
            status: a.status,
            patient_name: a.patient_name_snapshot,
        }));

        return {
            staff_id: staffId,
            staff_name: staff.name,
            date,
            is_available: true,
            scheduled_slots: scheduledSlots,
            booked_slots: bookedSlots,
        };
    }
}
