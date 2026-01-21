
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sanitizePayload } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
};

// Valid lead_status enum values from database
const VALID_STATUSES = [
    'New Inquiry',
    'Follow Up',
    'Converted',
    'Not Interested',
    'Lost',
];

// Common source values that might mistakenly be put into status field
const SOURCE_VALUES = ['Walk-In', 'Walk-in', 'Website', 'website', 'Referral', 'referral', 'Social Media', 'Phone Call'];

// Normalize and validate status values
function normalizeStatus(rawStatus: string | undefined | null): string {
    if (!rawStatus) return 'New Inquiry';

    const trimmed = rawStatus.trim();

    // Check if it's a valid status (case-insensitive match)
    const matchedStatus = VALID_STATUSES.find(
        s => s.toLowerCase() === trimmed.toLowerCase()
    );
    if (matchedStatus) return matchedStatus;

    // Map common variations
    const statusMap: Record<string, string> = {
        'new': 'New Inquiry',
        'new inquiry': 'New Inquiry',
        'inquiry': 'New Inquiry',
        'contacted': 'Follow Up',
        'follow up': 'Follow Up',
        'followup': 'Follow Up',
        'follow-up': 'Follow Up',
        'converted': 'Converted',
        'won': 'Converted',
        'closed': 'Converted',
        'not interested': 'Not Interested',
        'notinterested': 'Not Interested',
        'lost': 'Lost',
        'dead': 'Lost',
    };

    const mapped = statusMap[trimmed.toLowerCase()];
    if (mapped) return mapped;

    // If it looks like a source value, default to 'New Inquiry'
    if (SOURCE_VALUES.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
        return 'New Inquiry';
    }

    // Default fallback
    return 'New Inquiry';
}

// Check if a value looks like a source (for smart field detection)
function looksLikeSource(value: string | undefined | null): boolean {
    if (!value) return false;
    return SOURCE_VALUES.some(s => s.toLowerCase() === value.trim().toLowerCase());
}

// Column name mapping: maps various CSV column names to our database field names
// This handles different cases, spaces, underscores, and common variations
const COLUMN_MAPPINGS: Record<string, string> = {
    // Name variations
    'name': 'name',
    'fullname': 'name',
    'full name': 'name',
    'full_name': 'name',
    'leadname': 'name',
    'lead name': 'name',
    'lead_name': 'name',
    'customer': 'name',
    'customer name': 'name',
    'customer_name': 'name',
    'client': 'name',
    'client name': 'name',
    'client_name': 'name',

    // Phone variations
    'phone': 'phone',
    'phonenumber': 'phone',
    'phone number': 'phone',
    'phone_number': 'phone',
    'mobile': 'phone',
    'mobilenumber': 'phone',
    'mobile number': 'phone',
    'mobile_number': 'phone',
    'contact': 'phone',
    'contactnumber': 'phone',
    'contact number': 'phone',
    'contact_number': 'phone',
    'tel': 'phone',
    'telephone': 'phone',

    // Status variations
    'status': 'status',
    'leadstatus': 'status',
    'lead status': 'status',
    'lead_status': 'status',
    'state': 'status',
    'stage': 'status',

    // Date variations
    'date': 'date_added',
    'dateadded': 'date_added',
    'date added': 'date_added',
    'date_added': 'date_added',
    'createdon': 'date_added',
    'created on': 'date_added',
    'created_on': 'date_added',
    'createdat': 'date_added',
    'created at': 'date_added',
    'created_at': 'date_added',
    'createddate': 'date_added',
    'created date': 'date_added',
    'created_date': 'date_added',
    'addeddate': 'date_added',
    'added date': 'date_added',
    'added_date': 'date_added',
    'enquirydate': 'date_added',
    'enquiry date': 'date_added',
    'enquiry_date': 'date_added',

    // Age variations
    'age': 'age',
    'years': 'age',
    'yearsold': 'age',
    'years old': 'age',
    'years_old': 'age',

    // Gender variations
    'gender': 'gender',
    'sex': 'gender',
    'm/f': 'gender',

    // Source variations
    'source': 'source',
    'leadsource': 'source',
    'lead source': 'source',
    'lead_source': 'source',
    'origin': 'source',
    'channel': 'source',
    'referral': 'source',
    'referralsource': 'source',
    'referral source': 'source',
    'referral_source': 'source',

    // Inquiry variations
    'inquiry': 'inquiry',
    'enquiry': 'inquiry',
    'query': 'inquiry',
    'question': 'inquiry',
    'interestedin': 'inquiry',
    'interested in': 'inquiry',
    'interested_in': 'inquiry',
    'service': 'inquiry',
    'servicerequested': 'inquiry',
    'service requested': 'inquiry',
    'service_requested': 'inquiry',

    // Problem variations
    'problem': 'problem',
    'issue': 'problem',
    'concern': 'problem',
    'complaint': 'problem',
    'condition': 'problem',
    'medicalcondition': 'problem',
    'medical condition': 'problem',
    'medical_condition': 'problem',
    'diagnosis': 'problem',
    'symptoms': 'problem',
    'healthissue': 'problem',
    'health issue': 'problem',
    'health_issue': 'problem',
    'notes': 'problem',
    'remarks': 'problem',
    'description': 'problem',

    // Treatment Doctor variations
    'treatmentdoctor': 'treatment_doctor',
    'treatment doctor': 'treatment_doctor',
    'treatment_doctor': 'treatment_doctor',
    'doctor': 'treatment_doctor',
    'doctorname': 'treatment_doctor',
    'doctor name': 'treatment_doctor',
    'doctor_name': 'treatment_doctor',
    'assigneddoctor': 'treatment_doctor',
    'assigned doctor': 'treatment_doctor',
    'assigned_doctor': 'treatment_doctor',
    'physician': 'treatment_doctor',
    'consultant': 'treatment_doctor',

    // Treatment Suggested variations
    'treatmentsuggested': 'treatment_suggested',
    'treatment suggested': 'treatment_suggested',
    'treatment_suggested': 'treatment_suggested',
    'treatment': 'treatment_suggested',
    'treatmentplan': 'treatment_suggested',
    'treatment plan': 'treatment_suggested',
    'treatment_plan': 'treatment_suggested',
    'suggestedtreatment': 'treatment_suggested',
    'suggested treatment': 'treatment_suggested',
    'suggested_treatment': 'treatment_suggested',
    'procedure': 'treatment_suggested',
    'recommendedtreatment': 'treatment_suggested',
    'recommended treatment': 'treatment_suggested',
    'recommended_treatment': 'treatment_suggested',

    // Assigned User variations
    'assignedtouserid': 'assigned_to_user_id',
    'assigned to user id': 'assigned_to_user_id',
    'assigned_to_user_id': 'assigned_to_user_id',
    'assignedto': 'assigned_to_user_id',
    'assigned to': 'assigned_to_user_id',
    'assigned_to': 'assigned_to_user_id',
    'assignee': 'assigned_to_user_id',
    'owner': 'assigned_to_user_id',
    'salesperson': 'assigned_to_user_id',
    'sales person': 'assigned_to_user_id',
    'sales_person': 'assigned_to_user_id',
    'handler': 'assigned_to_user_id',
};

// Normalize a lead object by mapping its keys to expected field names
// Check if a value looks like a status
function looksLikeStatus(value: string | undefined | null): boolean {
    if (!value) return false;
    const trimmed = value.trim().toLowerCase();

    // Check exact matches with valid statuses
    if (VALID_STATUSES.some(s => s.toLowerCase() === trimmed)) return true;

    // Check common status patterns
    const statusPatterns = [
        'new', 'inquiry', 'new inquiry',
        'contacted',
        'follow up', 'followup', 'follow-up',
        'converted', 'won', 'closed',
        'not interested', 'notinterested',
        'lost', 'dead',
        'stalling', 'stalling - sent to cro', 'stalling-sent to cro', 'sent to cro',
        'pending', 'in progress', 'inprogress',
        'qualified', 'unqualified',
        'hot', 'warm', 'cold',
        'bulk import', 'imported'
    ];

    return statusPatterns.includes(trimmed) || trimmed.includes('stalling') || trimmed.includes('inquiry');
}

function normalizeLead(lead: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};

    for (const [key, value] of Object.entries(lead)) {
        // Normalize the key: lowercase, trim
        const normalizedKey = key.toLowerCase().trim();

        // Try to find a mapping for this key
        const mappedField = COLUMN_MAPPINGS[normalizedKey];

        if (mappedField) {
            // If we already have a value for this field, don't overwrite
            if (normalized[mappedField] === undefined) {
                normalized[mappedField] = value;
            }
        } else {
            // Keep the original key if no mapping found (might still be useful)
            if (normalized[normalizedKey] === undefined) {
                normalized[normalizedKey] = value;
            }
        }
    }

    // Smart detection: if source looks like status and status looks like source, swap them
    const sourceVal = normalized.source;
    const statusVal = normalized.status;

    if (looksLikeStatus(sourceVal) && looksLikeSource(statusVal)) {
        // Swap: source and status are reversed
        console.log(`Swapping source/status: source="${sourceVal}" <-> status="${statusVal}"`);
        normalized.source = statusVal;
        normalized.status = sourceVal;
    } else if (looksLikeStatus(sourceVal) && !looksLikeSource(statusVal)) {
        // Source has a status value but status doesn't have a source value
        if (!statusVal) {
            normalized.status = sourceVal;
        }
        normalized.source = undefined;
    }

    return normalized;
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: Request) {
    const supabase = getSupabaseAdmin();

    try {
        const toValue = (val: any) => {
            if (val === undefined || val === null) return undefined;
            // Convert to string to check if it's empty, but return original if it's not a string/empty
            if (typeof val === 'string' && val.trim() === '') return undefined;
            return val;
        };

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { success: false, error: 'Invalid JSON body' },
                { status: 400, headers: corsHeaders }
            );
        }

        const leads = body.leads;

        if (!Array.isArray(leads)) {
            return NextResponse.json(
                { success: false, error: 'leads must be an array' },
                { status: 400, headers: corsHeaders }
            );
        }

        const errors: any[] = [];
        const validLeadsToInsert: any[] = [];

        // 3. First normalize all leads to handle different column name formats
        const normalizedLeads = leads.map((lead: Record<string, any>) => normalizeLead(lead));

        // 4. Gather all phone numbers to check for duplicates
        const phonesForCheck = normalizedLeads
            .map(l => toValue(l.phone))
            .filter((p): p is string => !!p);

        // 5. Check current DB for these phones
        let existingPhones = new Set<string>();
        if (phonesForCheck.length > 0) {
            const { data: existingData, error: checkError } = await supabase
                .from('sakhi_clinic_leads')
                .select('phone')
                .in('phone', phonesForCheck);

            if (checkError) {
                throw checkError;
            }

            if (existingData) {
                existingData.forEach(row => existingPhones.add(row.phone));
            }
        }

        // 6. Process each normalized lead
        for (const lead of normalizedLeads) {
            const phone = toValue(lead.phone);
            const name = toValue(lead.name);

            if (!name || !phone) {
                errors.push({ phone: phone || 'N/A', name: name || 'N/A', reason: 'Missing name or phone' });
                continue;
            }

            if (existingPhones.has(phone)) {
                errors.push({ phone, name, reason: 'Duplicate - already exists in database' });
                continue;
            }

            // Handle in-batch duplicates (e.g. CSV has same number twice)
            if (validLeadsToInsert.find(l => l.phone === phone)) {
                errors.push({ phone, name, reason: 'Duplicate in batch' });
                continue;
            }

            const payload = sanitizePayload({
                name,
                phone,
                status: normalizeStatus(toValue(lead.status)),
                date_added: toValue(lead.date_added),
                age: toValue(lead.age),
                gender: toValue(lead.gender),
                // Smart source detection: if status looks like a source and source is empty, use status value as source
                source: toValue(lead.source) || (looksLikeSource(toValue(lead.status)) ? toValue(lead.status) : undefined),
                inquiry: toValue(lead.inquiry),
                problem: toValue(lead.problem),
                treatment_doctor: toValue(lead.treatment_doctor),
                treatment_suggested: toValue(lead.treatment_suggested),
                assigned_to_user_id: toValue(lead.assigned_to_user_id),
            });

            validLeadsToInsert.push(payload);
        }

        // 4. Batch Insert
        let successCount = 0;

        if (validLeadsToInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('sakhi_clinic_leads')
                .insert(validLeadsToInsert);

            if (insertError) {
                // If batch insert fails, we might want to try one by one or just fail the batch?
                // Usually Supabase Insert is all or nothing unless ignored? 
                // We will assume it's critical if fails.
                throw insertError;
            }
            successCount = validLeadsToInsert.length;
        }

        return NextResponse.json({
            success: true,
            count: successCount,
            failed: errors.length,
            errors: errors
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('POST /api/leads/bulk', error);
        return NextResponse.json(
            { success: false, error: error?.message || 'Internal Server Error' },
            { status: 500, headers: corsHeaders }
        );
    }
}
