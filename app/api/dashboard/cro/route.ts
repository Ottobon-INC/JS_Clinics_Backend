import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

const CRO_STAGES = ['New Lead', '1st Consult', 'Follow-up', 'Converted Patient'];
const CRO_QUEUE_STATUS = 'Stalling - Sent to CRO';
const CONVERTED_STATUSES = ['Converted Patient', 'Converted - Active Patient'];
const LOST_STATUSES = ['Lost', 'Inactive', 'Dropped'];

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  try {
    // Leads counts for KPIs and funnel
    const { data: leads, error: leadsError } = await supabase
      .from('sakhi_clinic_leads')
      .select('id, status, date_added, created_at');

    if (leadsError) throw leadsError;

    const totalLeads = leads?.length ?? 0;
    const convertedCount = (leads ?? []).filter((l) =>
      CONVERTED_STATUSES.includes(l.status || '')
    ).length;
    const croQueue = (leads ?? []).filter((l) => (l.status || '') === CRO_QUEUE_STATUS);
    const croQueueCount = croQueue.length;
    const croResolvedCount = convertedCount; // proxy for CRO success
    const lostCount = (leads ?? []).filter((l) => LOST_STATUSES.includes(l.status || '')).length;

    // Conversion rate & CRO success rate with NaN guards
    const conversionRateRaw = totalLeads ? (convertedCount / totalLeads) * 100 : 0;
    const croSuccessRateRaw = croQueueCount ? (croResolvedCount / croQueueCount) * 100 : 0;
    const churnRateRaw = totalLeads ? (lostCount / totalLeads) * 100 : 0;
    const conversionRate = Number.isFinite(conversionRateRaw) ? conversionRateRaw : 0;
    const croSuccessRate = Number.isFinite(croSuccessRateRaw) ? croSuccessRateRaw : 0;
    const churnRate = Number.isFinite(churnRateRaw) ? churnRateRaw : 0;

    // Average time to convert: patient.registration_date - lead.date_added
    let avgTimeToConvertDays = 0;
    {
      const { data: patientLinks, error: patientLinksError } = await supabase
        .from('sakhi_clinic_patients')
        .select('lead_id, registration_date, created_at')
        .not('lead_id', 'is', null);

      if (patientLinksError) throw patientLinksError;

      const leadMap = new Map<string, any>();
      (leads ?? []).forEach((l) => {
        leadMap.set(l.id, l);
      });

      const diffs: number[] = [];
      (patientLinks ?? []).forEach((p) => {
        if (!p.lead_id) return;
        const lead = leadMap.get(p.lead_id);
        if (!lead?.date_added) return;
        const start = new Date(lead.date_added);
        const end = new Date(p.registration_date || p.created_at || start);
        const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        if (!Number.isNaN(diffDays) && diffDays >= 0) {
          diffs.push(diffDays);
        }
      });
      if (diffs.length) {
        avgTimeToConvertDays = diffs.reduce((a, b) => a + b, 0) / diffs.length;
        if (!Number.isFinite(avgTimeToConvertDays)) {
          avgTimeToConvertDays = 0;
        }
      }
    }

    // Funnel counts (month-to-date)
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const startOfMonthISO = startOfMonth.toISOString();

    const leadsInMonth = (leads ?? []).filter((l) => {
      const d = l.date_added || l.created_at;
      return d ? new Date(d).toISOString() >= startOfMonthISO : false;
    });

    const funnel = {
      newLeads: leadsInMonth.length,
      firstConsult: leadsInMonth.filter((l) =>
        ['Consultation Done', 'Visited'].includes(l.status || '')
      ).length,
      followUp: leadsInMonth.filter((l) =>
        ['Stalling - Sent to CRO', 'Follow Up'].includes(l.status || '')
      ).length,
      converted: leadsInMonth.filter((l) =>
        ['Converted', 'Converted Patient', 'Converted - Active Patient'].includes(l.status || '')
      ).length,
    };

    // Intervention queue: leads with CRO queue status
    const { data: queueDataRaw, error: queueError } = await supabase
      .from('sakhi_clinic_leads')
      .select('id, name, phone, status, date_added, created_at')
      .eq('status', CRO_QUEUE_STATUS)
      .order('date_added', { ascending: true });

    if (queueError) throw queueError;

    const now = Date.now();
    const queueData =
      queueDataRaw?.map((row) => {
        const baseDate = row.date_added || row.created_at || new Date().toISOString();
        const diffMs = now - new Date(baseDate).getTime();
        const stalledDays = diffMs > 0 ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) : 0;
        return {
          ...row,
          stalledDays,
          priority: 'High',
        };
      }) ?? [];

    return NextResponse.json(
      {
        success: true,
        data: {
          kpis: {
            conversionRate,
            croSuccessRate,
            avgTimeToConvertDays,
            patientChurnRate: churnRate,
          },
          funnel,
          interventionQueue: queueData ?? [],
        },
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('GET /api/dashboard/cro', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
