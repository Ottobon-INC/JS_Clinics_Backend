import { GET as getLeads } from '@/app/api/leads/route';
import { PATCH as updateLeadById } from '@/app/api/leads/[id]/route';
import { POST as createPatient } from '@/app/api/patients/route';
import { logChatbotAction } from '../core/audit';
import { NextResponse } from 'next/server';

// Helper to parse NextResponse
async function parseResponse(res: Response | NextResponse) {
    const data = await res.json();
    return { status: res.status, data };
}

export async function fetchStallingLeads() {
    // Construct internal request
    // Using 127.0.0.1:3200 because the user explicitly requested port 3200
    // 'Stalling' is not a valid DB Enum value; using 'Follow Up' as proxy.
    const req = new Request('http://127.0.0.1:3200/api/leads?status=Follow%20Up&limit=5');

    try {
        const res = await getLeads(req);
        const { status, data } = await parseResponse(res);

        if (status === 200 && data.success) {
            if (!data.data.items || data.data.items.length === 0) {
                return "No stalling leads found at the moment.";
            }
            return data.data.items.map((l: any) =>
                `- ${l.name} (${l.phone}): Added on ${l.date_added}`
            ).join('\n');
        }

        // Debug logging
        console.error(`FETCH STALLING INTERNAL FAIL: Status ${status}`, JSON.stringify(data));
        return `Failed to fetch leads. Internal Status: ${status}, Error: ${data.error || JSON.stringify(data)}`;

    } catch (e: any) {
        console.error('FETCH STALLING EXCEPTION:', e);
        return `An error occurred while fetching data: ${e.message}`;
    }
}

export async function getLeadByPhone(phone: string) {
    const req = new Request(`http://127.0.0.1:3200/api/leads?phone=${phone}`);
    try {
        const res = await getLeads(req);
        const { status, data } = await parseResponse(res);
        if (status === 200 && data.success && data.data && data.data.items.length > 0) {
            return data.data.items[0];
        }
        return null;
    } catch (e) {
        console.error('GET LEAD BY PHONE ERROR:', e);
        return null;
    }
}

export async function convertLeadToPatient(
    requestId: string,
    userId: string,
    role: string,
    leadData: any
) {
    // 1. Create Patient
    const patientPayload = {
        name: leadData.name,
        mobile: leadData.phone,
        age: leadData.age,
        gender: leadData.gender,
        status: 'OPD',
        lead_id: leadData.id,
    };

    const createReq = new Request('http://127.0.0.1:3200/api/patients', {
        method: 'POST',
        body: JSON.stringify(patientPayload)
    });

    let patientId: string | null = null;
    let uhid: string | null = null;

    try {
        const createRes = await createPatient(createReq);
        const createResult = await parseResponse(createRes);

        if (createResult.status !== 200 && createResult.status !== 201 || !createResult.data.success) {
            return {
                success: false,
                message: `Failed conversation: ${createResult.data.error || 'Could not create patient record'}`
            };
        }

        patientId = createResult.data.data.id;
        uhid = createResult.data.data.uhid;
    } catch (e: any) {
        return { success: false, message: `System error creating patient: ${e.message}` };
    }

    // 2. Update Lead Status
    const updateReq = new Request(`http://127.0.0.1:3200/api/leads/${leadData.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Converted' })
    });

    const routeContext = { params: { id: leadData.id } };

    try {
        const updateRes = await updateLeadById(updateReq, routeContext);
        const updateResult = await parseResponse(updateRes);

        if (updateResult.status === 200 && updateResult.data.success) {
            return {
                success: true,
                message: `Successfully converted ${leadData.name} to Patient (UHID: ${uhid}).`,
                data: { patientId, uhid }
            };
        } else {
            throw new Error(updateResult.data.error || 'Lead update failed');
        }
    } catch (e: any) {
        const errorMsg = `PARTIAL FAILURE: Patient created (${uhid}) but Lead status update failed. Please manually update Lead ${leadData.name} to 'Converted'.`;

        await logChatbotAction({
            request_id: requestId,
            user_id: userId,
            role: role,
            intent: 'SYSTEM_ERROR',
            action_details: {
                error: 'LEAD_CONVERSION_PARTIAL_FAILURE',
                details: errorMsg,
                patient_id: patientId,
                lead_id: leadData.id
            }
        });

        return {
            success: true,
            message: errorMsg,
            action_required: 'MANUAL_FIX_LEAD_STATUS'
        };
    }
}
