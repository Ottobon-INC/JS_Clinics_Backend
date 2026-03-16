import { getSupabaseAdmin } from '@/lib/supabase';
import { sanitizePayload } from '@/lib/utils';

export type GetAppointmentsParams = {
    page?: number;
    limit?: number;
    date?: string | null;
    doctorId?: string | null;
    status?: string | null;
    mobile?: string | null;
};

const allowedTypes = ['Consultation', 'Follow-up', 'Procedure', 'Emergency', 'Scan', 'Surgery', 'Camp'];

function isUuid(value: string) {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        value
    );
}

export class AppointmentsService {
    static async getAppointments(params: GetAppointmentsParams) {
        const supabase = getSupabaseAdmin();
        const page = params.page || 1;
        const limit = params.limit || 20;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('sakhi_clinic_appointments')
            .select(
                params.mobile
                    ? '*, sakhi_clinic_patients!inner(mobile)'
                    : '*',
                { count: 'exact' }
            )
            .order('appointment_date', { ascending: true })
            .range(from, to);

        if (params.date) {
            query = query.eq('appointment_date', params.date);
        }
        if (params.doctorId && isUuid(params.doctorId)) {
            query = query.eq('doctor_id', params.doctorId);
        }
        if (params.status) {
            query = query.eq('status', params.status);
        }
        if (params.mobile) {
            query = query.eq('sakhi_clinic_patients.mobile', params.mobile);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        const items = (data as any[] | null) ?? [];
        const cleanedItems = items.map((item) => {
            const { sakhi_clinic_patients, ...rest } = item as any;
            return rest;
        });

        return {
            items: cleanedItems,
            pagination: {
                page,
                limit,
                total: count ?? cleanedItems.length ?? 0,
            },
        };
    }

    static async createAppointment(body: any) {
        const supabase = getSupabaseAdmin();

        let patient_id = body.patient_id;
        let lead_id = body.lead_id;
        let appointment_date = body.appointment_date;
        let start_time = body.start_time;
        let end_time = body.end_time;
        const doctorIdRaw = body.doctor_id;
        let doctor_id = doctorIdRaw && isUuid(doctorIdRaw) ? doctorIdRaw : null;
        const requestedType = typeof body.type === 'string' ? body.type : '';
        let type = 'Consultation';
        const normalizedType = requestedType.trim();
        if (allowedTypes.includes(normalizedType)) {
            type = normalizedType;
        } else if (!normalizedType || /ivf/i.test(normalizedType) || /other/i.test(normalizedType)) {
            type = 'Consultation';
        }
        let doctorNameSnapshot =
            body.doctor_name_snapshot ??
            body.doctor_name ??
            body.doctorName ??
            body.consultantName ??
            body.consultant ??
            body.doctor;
        let nameSnapshot = body.patient_name_snapshot ?? body.name;
        // Snapshot fallbacks
        const sexSnapshot = body.sex_snapshot ?? body.sex ?? body.gender;
        let patientPhoneSnapshot = body.patient_phone_snapshot ?? body.phone ?? body.mobile;
        const patientDobSnapshot = body.patient_dob_snapshot ?? body.dob;
        const patientEmailSnapshot = body.patient_email_snapshot ?? body.email;
        const patientAddressSnapshot = body.patient_address_snapshot ?? body.address ?? body.street;
        const patientPostalCodeSnapshot =
            body.patient_postal_code_snapshot ?? body.postalCode ?? body.postal_code ?? body.pin;
        const patientMaritalStatusSnapshot =
            body.patient_marital_status_snapshot ?? body.maritalStatus ?? body.marital_status;
        const patientAgeSnapshot = body.patient_age_snapshot ?? body.age;
        const source = body.source ?? body.referral_source ?? body.appointment_source;
        const referralDoctor = body.referral_doctor ?? body.referralDoctor;
        const referralDoctorPhone =
            body.referral_doctor_phone ?? body.referralDoctorPhone ?? body.refDoctorMobile;
        const referralNotes = body.referral_notes ?? body.referralNotes;

        if (!doctorNameSnapshot && doctorIdRaw && !isUuid(doctorIdRaw)) {
            doctorNameSnapshot = doctorIdRaw;
        }

        // No doctor name lookup against users to avoid missing column issues; rely on provided name/ID.

        if (!patient_id && !lead_id) {
            if (body.name && body.phone) {
                const { data: existingLead, error: existingLeadError } = await supabase
                    .from('sakhi_clinic_leads')
                    .select('id')
                    .eq('phone', body.phone)
                    .maybeSingle();

                if (existingLeadError && existingLeadError.code !== 'PGRST116') {
                    throw existingLeadError;
                }

                if (existingLead?.id) {
                    lead_id = existingLead.id;
                } else {
                    const { data: newLead, error: leadError } = await supabase
                        .from('sakhi_clinic_leads')
                        .insert(
                            sanitizePayload({
                                name: body.name,
                                phone: body.phone,
                            })
                        )
                        .select('id, name, phone')
                        .single();

                    if (leadError) throw leadError;
                    lead_id = newLead?.id;
                    if (!nameSnapshot) nameSnapshot = newLead?.name ?? nameSnapshot;
                    if (!patientPhoneSnapshot) patientPhoneSnapshot = newLead?.phone ?? patientPhoneSnapshot;
                }
            } else {
                throw new Error('patient_id or lead_id is required');
            }
        }

        if (patient_id) {
            if (!isUuid(patient_id)) {
                throw new Error('Invalid patient id');
            }
            const { data: patient, error: patientError } = await supabase
                .from('sakhi_clinic_patients')
                .select('id, name, mobile')
                .eq('id', patient_id)
                .single();

            if (patientError?.code === 'PGRST116' || !patient) {
                throw new Error('Patient not found');
            }
            if (patientError) throw patientError;

            if (!nameSnapshot) nameSnapshot = patient.name;
            if (!patientPhoneSnapshot) patientPhoneSnapshot = patient.mobile;
        }

        if (lead_id && !patient_id && (!nameSnapshot || !patientPhoneSnapshot)) {
            const { data: leadRow, error: leadError } = await supabase
                .from('sakhi_clinic_leads')
                .select('name, phone')
                .eq('id', lead_id)
                .single();

            if (leadError && leadError.code !== 'PGRST116') {
                throw leadError;
            }

            if (leadRow) {
                if (!nameSnapshot) nameSnapshot = leadRow.name ?? nameSnapshot;
                if (!patientPhoneSnapshot) patientPhoneSnapshot = leadRow.phone ?? patientPhoneSnapshot;
            }
        }

        if (!appointment_date) {
            appointment_date = new Date().toISOString().split('T')[0];
        }

        if (!start_time) {
            const now = new Date();
            start_time = now.toISOString().split('T')[1].slice(0, 5);
        }
        if (!end_time) {
            // Default end_time to start_time when not provided to satisfy NOT NULL constraint
            end_time = start_time;
        }

        if (doctor_id && !doctorNameSnapshot) {
            const { data: doctorRow, error: doctorNameError } = await supabase
                .from('sakhi_clinic_users')
                .select('name')
                .eq('id', doctor_id)
                .maybeSingle();

            if (doctorNameError && doctorNameError.code !== 'PGRST116') {
                throw doctorNameError;
            }

            doctorNameSnapshot = doctorRow?.name ?? doctorNameSnapshot;
        }

        const payload = sanitizePayload({
            patient_id,
            lead_id,
            doctor_id,
            appointment_date,
            start_time,
            end_time,
            type,
            status: body.status,
            visit_reason: body.visit_reason,
            resource_id: body.resource_id,
            patient_name_snapshot: nameSnapshot,
            sex_snapshot: sexSnapshot,
            doctor_name_snapshot: doctorNameSnapshot,
            patient_phone_snapshot: patientPhoneSnapshot,
            patient_dob_snapshot: patientDobSnapshot,
            patient_email_snapshot: patientEmailSnapshot,
            patient_address_snapshot: patientAddressSnapshot,
            patient_postal_code_snapshot: patientPostalCodeSnapshot,
            patient_marital_status_snapshot: patientMaritalStatusSnapshot,
            patient_age_snapshot: patientAgeSnapshot,
            source,
            referral_doctor: referralDoctor,
            referral_doctor_phone: referralDoctorPhone,
            referral_notes: referralNotes,
        });

        const { data, error } = await supabase
            .from('sakhi_clinic_appointments')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        return data;
    }
}
