
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { validateSession } from '@/lib/auth';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: Request) {
    const { error: authError } = await validateSession(request);
    if (authError) return authError;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    const status = searchParams.get('status');
    const q = searchParams.get('q');

    try {
        let query = supabase
            .from('sakhi_clinic_leads')
            .select('*')
            .order('date_added', { ascending: false });

        // Apply same filters as the main list endpoint
        if (phone) {
            query = query.eq('phone', phone);
        } else if (status) {
            query = query.eq('status', status);
        } else if (q) {
            query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
        }

        const { data, error } = await query;
        if (error) throw error;


        const leads = data?.map(lead => ({
            ...lead,
            problem: decrypt(lead.problem),
            treatment_suggested: decrypt(lead.treatment_suggested),
            treatment_doctor: decrypt(lead.treatment_doctor),
        })) || [];

        // Define CSV Columns

        const columns = [
            { header: 'Name', key: 'name' },
            { header: 'Phone', key: 'phone' },
            { header: 'Status', key: 'status' },
            { header: 'Date Added', key: 'date_added' },
            { header: 'Age', key: 'age' },
            { header: 'Gender', key: 'gender' },
            { header: 'Source', key: 'source' },
            { header: 'Inquiry', key: 'inquiry' },
            { header: 'Problem', key: 'problem' },
            { header: 'Treatment Doctor', key: 'treatment_doctor' },
            { header: 'Treatment Suggested', key: 'treatment_suggested' },
            { header: 'Assigned User ID', key: 'assigned_to_user_id' },
        ];

        // Helper to escape CSV fields
        const escapeCsv = (field: any) => {
            if (field === null || field === undefined) {
                return '';
            }
            const stringField = String(field);
            if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
                return `"${stringField.replace(/"/g, '""')}"`;
            }
            return stringField;
        };

        // Build CSV Content
        const headerRow = columns.map(c => escapeCsv(c.header)).join(',');
        const rows = leads.map(lead => {
            return columns.map(c => escapeCsv(lead[c.key])).join(',');
        });

        const csvContent = [headerRow, ...rows].join('\n');

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="leads_export.csv"',
            }
        });

    } catch (error: any) {
        console.error('GET /api/leads/export', error);
        return NextResponse.json(
            { success: false, error: error?.message || 'Internal Server Error' },
            { status: 500, headers: corsHeaders }
        );
    }
}
