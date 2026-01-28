
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().split('T')[0];

    try {
        const { data: leads, error } = await supabase
            .from('sakhi_clinic_leads')
            .select('status')
            .gte('date_added', today);

        if (error) throw error;

        const counts = (leads || []).reduce<Record<string, number>>((acc, curr) => {
            const status = curr.status || 'New';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});

        // Mapping loosely to requested keys based on likely statuses in DB
        // Requested: "new", "contacted", "stalling", "converted"
        // DB likely has: "New Inquiry", "Start", "Follow Up", "Stalling", "Converted" etc.
        // I need to map "Follow Up" to "contacted" probably.

        // Helper to partial match keys
        const sumMatches = (patterns: string[]) => {
            let sum = 0;
            Object.keys(counts).forEach(key => {
                if (patterns.some(p => key.toLowerCase().includes(p))) {
                    sum += counts[key];
                }
            });
            return sum;
        };

        // Specific mapping attempt
        const newLeads = sumMatches(['new', 'inquiry', 'open']);
        const contacted = sumMatches(['contacted', 'follow', 'visit']);
        const stalling = sumMatches(['stalling', 'pending', 'hold']);
        const converted = sumMatches(['converted', 'won', 'booked']);

        return NextResponse.json({
            new: newLeads,
            contacted: contacted,
            stalling: stalling,
            converted: converted
        });

    } catch (error: any) {
        console.error('GET /api/control-tower/lead-summary', error);
        return NextResponse.json(
            { error: error?.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
