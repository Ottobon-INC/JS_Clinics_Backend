import { getSupabaseAdmin } from '@/lib/supabase';
import { sanitizePayload } from '@/lib/utils';
import { encrypt, decrypt } from '@/lib/encryption';

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

// Column name mapping: maps various CSV column names to our database field names
// Includes both lowercase and capitalized versions for comprehensive matching
const COLUMN_MAPPINGS: Record<string, string> = {
    // Name variations - lowercase and capitalized
    'name': 'name', 'Name': 'name', 'NAME': 'name',
    'fullname': 'name', 'FullName': 'name', 'Fullname': 'name', 'Full Name': 'name', 'full name': 'name',
    'full_name': 'name', 'Full_Name': 'name',
    'leadname': 'name', 'LeadName': 'name', 'Lead Name': 'name', 'lead name': 'name',
    'customer': 'name', 'Customer': 'name', 'Customer Name': 'name', 'customer name': 'name',
    'client': 'name', 'Client': 'name', 'Client Name': 'name', 'client name': 'name',

    // Phone variations - lowercase and capitalized
    'phone': 'phone', 'Phone': 'phone', 'PHONE': 'phone',
    'phonenumber': 'phone', 'PhoneNumber': 'phone', 'Phone Number': 'phone', 'phone number': 'phone',
    'mobile': 'phone', 'Mobile': 'phone', 'MOBILE': 'phone',
    'mobilenumber': 'phone', 'MobileNumber': 'phone', 'Mobile Number': 'phone', 'mobile number': 'phone',
    'contact': 'phone', 'Contact': 'phone', 'Contact Number': 'phone', 'contact number': 'phone',
    'tel': 'phone', 'Tel': 'phone', 'telephone': 'phone', 'Telephone': 'phone',

    // Status variations - lowercase and capitalized
    'status': 'status', 'Status': 'status', 'STATUS': 'status',
    'leadstatus': 'status', 'LeadStatus': 'status', 'Lead Status': 'status', 'lead status': 'status',
    'state': 'status', 'State': 'status', 'stage': 'status', 'Stage': 'status',

    // Date variations - lowercase and capitalized
    'date': 'date_added', 'Date': 'date_added', 'DATE': 'date_added',
    'dateadded': 'date_added', 'DateAdded': 'date_added', 'Date Added': 'date_added', 'date added': 'date_added',
    'date_added': 'date_added', 'Date_Added': 'date_added',
    'createdon': 'date_added', 'CreatedOn': 'date_added', 'Created On': 'date_added', 'created on': 'date_added',
    'createdat': 'date_added', 'CreatedAt': 'date_added', 'Created At': 'date_added', 'created at': 'date_added',
    'createddate': 'date_added', 'CreatedDate': 'date_added', 'Created Date': 'date_added', 'created date': 'date_added',
    'addeddate': 'date_added', 'AddedDate': 'date_added', 'Added Date': 'date_added', 'added date': 'date_added',
    'enquirydate': 'date_added', 'EnquiryDate': 'date_added', 'Enquiry Date': 'date_added', 'enquiry date': 'date_added',

    // Age variations - lowercase and capitalized (CRITICAL)
    'age': 'age', 'Age': 'age', 'AGE': 'age',
    'years': 'age', 'Years': 'age',
    'yearsold': 'age', 'YearsOld': 'age', 'Years Old': 'age', 'years old': 'age',
    'patientage': 'age', 'PatientAge': 'age', 'Patient Age': 'age', 'patient age': 'age',

    // Gender variations - lowercase and capitalized (CRITICAL)
    'gender': 'gender', 'Gender': 'gender', 'GENDER': 'gender',
    'sex': 'gender', 'Sex': 'gender', 'SEX': 'gender',
    'm/f': 'gender', 'M/F': 'gender',
    'male/female': 'gender', 'Male/Female': 'gender',
    'patientgender': 'gender', 'PatientGender': 'gender', 'Patient Gender': 'gender', 'patient gender': 'gender',

    // Source variations - lowercase and capitalized
    'source': 'source', 'Source': 'source', 'SOURCE': 'source',
    'leadsource': 'source', 'LeadSource': 'source', 'Lead Source': 'source', 'lead source': 'source',
    'origin': 'source', 'Origin': 'source', 'channel': 'source', 'Channel': 'source',
    'referralsource': 'source', 'ReferralSource': 'source', 'Referral Source': 'source', 'referral source': 'source',
    'medium': 'source', 'Medium': 'source', 'campaign': 'source', 'Campaign': 'source',

    // Inquiry variations - lowercase and capitalized
    'inquiry': 'inquiry', 'Inquiry': 'inquiry', 'INQUIRY': 'inquiry',
    'enquiry': 'inquiry', 'Enquiry': 'inquiry', 'ENQUIRY': 'inquiry',
    'query': 'inquiry', 'Query': 'inquiry', 'question': 'inquiry', 'Question': 'inquiry',
    'interestedin': 'inquiry', 'InterestedIn': 'inquiry', 'Interested In': 'inquiry', 'interested in': 'inquiry',
    'service': 'inquiry', 'Service': 'inquiry', 'requirement': 'inquiry', 'Requirement': 'inquiry',

    // Problem variations - lowercase and capitalized (CRITICAL)
    'problem': 'problem', 'Problem': 'problem', 'PROBLEM': 'problem',
    'issue': 'problem', 'Issue': 'problem', 'ISSUE': 'problem',
    'concern': 'problem', 'Concern': 'problem',
    'complaint': 'problem', 'Complaint': 'problem',
    'condition': 'problem', 'Condition': 'problem',
    'medicalcondition': 'problem', 'MedicalCondition': 'problem', 'Medical Condition': 'problem', 'medical condition': 'problem',
    'diagnosis': 'problem', 'Diagnosis': 'problem',
    'symptoms': 'problem', 'Symptoms': 'problem',
    'healthissue': 'problem', 'HealthIssue': 'problem', 'Health Issue': 'problem', 'health issue': 'problem',
    'notes': 'problem', 'Notes': 'problem', 'NOTES': 'problem',
    'remarks': 'problem', 'Remarks': 'problem', 'REMARKS': 'problem',
    'description': 'problem', 'Description': 'problem',
    'presenting problem': 'problem', 'Presenting Problem': 'problem', 'PresentingProblem': 'problem',
    'chief complaint': 'problem', 'Chief Complaint': 'problem', 'ChiefComplaint': 'problem',

    // Treatment Doctor variations - lowercase and capitalized
    'treatmentdoctor': 'treatment_doctor', 'TreatmentDoctor': 'treatment_doctor',
    'treatment doctor': 'treatment_doctor', 'Treatment Doctor': 'treatment_doctor',
    'treatment_doctor': 'treatment_doctor', 'Treatment_Doctor': 'treatment_doctor',
    'doctor': 'treatment_doctor', 'Doctor': 'treatment_doctor', 'DOCTOR': 'treatment_doctor',
    'doctorname': 'treatment_doctor', 'DoctorName': 'treatment_doctor', 'Doctor Name': 'treatment_doctor',
    'assigneddoctor': 'treatment_doctor', 'AssignedDoctor': 'treatment_doctor', 'Assigned Doctor': 'treatment_doctor',
    'physician': 'treatment_doctor', 'Physician': 'treatment_doctor',
    'consultant': 'treatment_doctor', 'Consultant': 'treatment_doctor',
    'camp doctor': 'treatment_doctor', 'Camp Doctor': 'treatment_doctor', 'CampDoctor': 'treatment_doctor',

    // Treatment Suggested variations - lowercase and capitalized
    'treatmentsuggested': 'treatment_suggested', 'TreatmentSuggested': 'treatment_suggested',
    'treatment suggested': 'treatment_suggested', 'Treatment Suggested': 'treatment_suggested',
    'treatment_suggested': 'treatment_suggested', 'Treatment_Suggested': 'treatment_suggested',
    'treatment': 'treatment_suggested', 'Treatment': 'treatment_suggested', 'TREATMENT': 'treatment_suggested',
    'treatmentplan': 'treatment_suggested', 'TreatmentPlan': 'treatment_suggested', 'Treatment Plan': 'treatment_suggested',
    'suggestedtreatment': 'treatment_suggested', 'SuggestedTreatment': 'treatment_suggested', 'Suggested Treatment': 'treatment_suggested',
    'procedure': 'treatment_suggested', 'Procedure': 'treatment_suggested',
    'suggested tx': 'treatment_suggested', 'Suggested Tx': 'treatment_suggested', 'SuggestedTx': 'treatment_suggested',

    // Assigned User variations - lowercase and capitalized
    'assignedtouserid': 'assigned_to_user_id', 'AssignedToUserId': 'assigned_to_user_id',
    'assigned to user id': 'assigned_to_user_id', 'Assigned To User Id': 'assigned_to_user_id',
    'assigned_to_user_id': 'assigned_to_user_id', 'Assigned_To_User_Id': 'assigned_to_user_id',
    'assignedto': 'assigned_to_user_id', 'AssignedTo': 'assigned_to_user_id', 'Assigned To': 'assigned_to_user_id',
    'assignee': 'assigned_to_user_id', 'Assignee': 'assigned_to_user_id',
    'owner': 'assigned_to_user_id', 'Owner': 'assigned_to_user_id',
    'salesperson': 'assigned_to_user_id', 'SalesPerson': 'assigned_to_user_id', 'Sales Person': 'assigned_to_user_id',
    'handler': 'assigned_to_user_id', 'Handler': 'assigned_to_user_id',
    'staff': 'assigned_to_user_id', 'Staff': 'assigned_to_user_id', 'STAFF': 'assigned_to_user_id',

    // Guardian variations
    'guardianname': 'guardian_name', 'GuardianName': 'guardian_name', 'Guardian Name': 'guardian_name', 'guardian name': 'guardian_name',
    'husbandname': 'guardian_name', 'HusbandName': 'guardian_name', 'Husband Name': 'guardian_name', 'husband name': 'guardian_name',
    'husband/guardian name': 'guardian_name', 'Husband/Guardian Name': 'guardian_name',
    'husband_or_guardian_name': 'guardian_name', 'Husband_Or_Guardian_Name': 'guardian_name', // Exact frontend match

    // Guardian Age variations
    'guardianage': 'guardian_age', 'GuardianAge': 'guardian_age', 'Guardian Age': 'guardian_age', 'guardian age': 'guardian_age',
    'husbandage': 'guardian_age', 'HusbandAge': 'guardian_age', 'Husband Age': 'guardian_age', 'husband age': 'guardian_age',
    'husband_age': 'guardian_age', 'Husband_Age': 'guardian_age', // Exact frontend match

    // Location/City variations
    'location': 'location', 'Location': 'location', 'LOCATION': 'location',
    'city': 'location', 'City': 'location', 'CITY': 'location',
    'city/location': 'location', 'City/Location': 'location',
    'address': 'location', 'Address': 'location',

    // Alternate Phone variations
    'alternatephone': 'alternate_phone', 'AlternatePhone': 'alternate_phone', 'Alternate Phone': 'alternate_phone', 'alternate phone': 'alternate_phone',
    'altphone': 'alternate_phone', 'AltPhone': 'alternate_phone', 'Alt Phone': 'alternate_phone', 'alt phone': 'alternate_phone',
    'alternative phone number': 'alternate_phone', 'Alternative Phone Number': 'alternate_phone',
    'alternative_phone_number': 'alternate_phone', 'Alternative_Phone_Number': 'alternate_phone', // Exact frontend match

    // Referral Required variations
    'referralrequired': 'referral_required', 'ReferralRequired': 'referral_required', 'Referral Required': 'referral_required', 'referral required': 'referral_required',
};

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

// Normalize a lead object by mapping its keys to expected field names
function normalizeLead(lead: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};

    // Log all incoming keys for debugging
    console.log('=== normalizeLead Input ===');
    console.log('All keys received:', Object.keys(lead));
    for (const [key, value] of Object.entries(lead)) {
        console.log(`  Key: "${key}" -> Value: "${value}" (type: ${typeof value})`);
    }

    for (const [key, value] of Object.entries(lead)) {
        // First try direct case-sensitive lookup
        let mappedField = COLUMN_MAPPINGS[key];

        // If not found, try lowercase lookup
        if (!mappedField) {
            const lowerKey = key.toLowerCase().trim();
            mappedField = COLUMN_MAPPINGS[lowerKey];
        }

        if (mappedField) {
            if (normalized[mappedField] === undefined) {
                normalized[mappedField] = value;
                console.log(`  Mapped: "${key}" -> "${mappedField}" = "${value}"`);
            }
        } else {
            // If no mapping found, still keep the key with lowercase name
            const lowerKey = key.toLowerCase().trim();
            if (normalized[lowerKey] === undefined) {
                normalized[lowerKey] = value;
                console.log(`  Unmapped: "${key}" -> "${lowerKey}" = "${value}"`);
            }
        }
    }

    // Smart detection: if source looks like status and status looks like source, swap them
    const sourceVal = normalized.source;
    const statusVal = normalized.status;

    console.log(`=== Source/Status Check ===`);
    console.log(`  source value: "${sourceVal}" (looksLikeStatus: ${looksLikeStatus(sourceVal)}, looksLikeSource: ${looksLikeSource(sourceVal)})`);
    console.log(`  status value: "${statusVal}" (looksLikeStatus: ${looksLikeStatus(statusVal)}, looksLikeSource: ${looksLikeSource(statusVal)})`);

    if (looksLikeStatus(sourceVal) && looksLikeSource(statusVal)) {
        // Swap: source and status are reversed
        console.log(`  SWAPPING: source="${sourceVal}" <-> status="${statusVal}"`);
        normalized.source = statusVal;
        normalized.status = sourceVal;
    } else if (looksLikeStatus(sourceVal) && !statusVal) {
        // Source has a status value and status is empty
        console.log(`  Moving source to status: "${sourceVal}"`);
        normalized.status = sourceVal;
        normalized.source = undefined;
    } else if (looksLikeStatus(sourceVal)) {
        // Source has a status value but we also have a status
        console.log(`  Source has status value but we have status already, clearing source`);
        normalized.source = undefined;
    }

    console.log('=== normalizeLead Output ===');
    console.log('Normalized:', JSON.stringify(normalized, null, 2));

    return normalized;
}

export type GetLeadsParams = {
    page?: number;
    limit?: number;
    phone?: string | null;
    status?: string | null;
    q?: string | null;
};

export class LeadsService {
    static async getLeads(params: GetLeadsParams) {
        const supabase = getSupabaseAdmin();
        const page = params.page || 1;
        const limit = params.limit || 20;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('sakhi_clinic_leads')
            .select('*', { count: 'exact' })
            .order('date_added', { ascending: false })
            .range(from, to);

        if (params.phone) {
            query = query.eq('phone', params.phone);
        } else if (params.status) {
            query = query.eq('status', params.status);
        } else if (params.q) {
            query = query.or(`name.ilike.%${params.q}%,phone.ilike.%${params.q}%`);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        // Decrypt sensitive fields
        const decryptedData = data?.map(lead => ({
            ...lead,
            problem: decrypt(lead.problem),
            treatment_suggested: decrypt(lead.treatment_suggested),
            treatment_doctor: decrypt(lead.treatment_doctor),
        }));

        return {
            items: decryptedData ?? [],
            pagination: {
                page,
                limit,
                total: count ?? data?.length ?? 0,
            },
        };
    }

    static async createLead(rawBody: any) {
        const supabase = getSupabaseAdmin();

        const toValue = (val: any) => {
            if (val === undefined || val === null) return undefined;
            if (typeof val === 'string' && val.trim() === '') return undefined;
            return val;
        };

        // Normalize the incoming data
        const body = normalizeLead(rawBody);

        const name = toValue(body.name);
        const phone = toValue(body.phone);
        const status = toValue(body.status);
        const date_added = toValue(body.date_added);
        const age = toValue(body.age);
        const gender = toValue(body.gender);
        const source = toValue(body.source);
        const inquiry = toValue(body.inquiry);
        const problem = toValue(body.problem);
        const treatment_doctor = toValue(body.treatment_doctor);
        const treatment_suggested = toValue(body.treatment_suggested);
        const assigned_to_user_id = toValue(body.assigned_to_user_id);
        const guardian_name = toValue(body.guardian_name);
        const guardian_age = toValue(body.guardian_age);
        const location = toValue(body.location);
        const alternate_phone = toValue(body.alternate_phone);
        const referral_required = toValue(body.referral_required);

        if (!name || !phone) {
            throw new Error('name and phone are required');
        }

        const payload = sanitizePayload({
            name,
            phone,
            date_added,
            status: normalizeStatus(status),
            age,
            gender,
            source,
            inquiry,
            problem: encrypt(problem),
            treatment_doctor: encrypt(treatment_doctor),
            treatment_suggested: encrypt(treatment_suggested),
            assigned_to_user_id,
            guardian_name,
            guardian_age,
            location,
            alternate_phone,
            referral_required,
        });

        console.log('LeadsService.createLead - Final payload:', JSON.stringify(payload));

        const { data, error } = await supabase
            .from('sakhi_clinic_leads')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        return data;
    }
}
