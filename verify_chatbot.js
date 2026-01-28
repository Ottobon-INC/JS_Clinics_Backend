// Using native fetch (Node 18+)

const BASE_URL = 'http://127.0.0.1:3200/api/chatbot'; // Port 3200
const USER_ID = '123e4567-e89b-12d3-a456-426614174000'; // Dummy UUID
const ROLE = 'CRO';

async function verify() {
    console.log('=== START VERIFICATION ===');

    // Test 1: Fetch Stalling Leads
    console.log('\n[TEST 1] Fetch Stalling Leads...');
    try {
        const res = await fetch(BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: USER_ID,
                userRole: ROLE,
                userMessage: 'Show me list of stalling leads'
            })
        });
        // Check if response is valid JSON
        const text = await res.text();
        try {
            const json = JSON.parse(text);
            console.log('Status:', res.status);
            console.log('Response:', JSON.stringify(json, null, 2));
        } catch {
            console.log('Status:', res.status);
            console.log('Response (Text):', text);
        }
    } catch (e) {
        console.error('Failed Test 1:', e.message);
    }

    // Test 2: Role Permission Check (Nurse trying to convert)
    console.log('\n[TEST 2] Permission Denied (Nurse)...');
    try {
        const res = await fetch(BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: USER_ID,
                userRole: 'Nurse',
                userMessage: 'Convert lead 1234567890 to patient'
            })
        });
        const text = await res.text();
        try {
            const json = JSON.parse(text);
            console.log('Status:', res.status);
            console.log('Response:', JSON.stringify(json, null, 2));
        } catch {
            console.log('Status:', res.status);
            console.log('Response (Text):', text);
        }
    } catch (e) {
        console.error('Failed Test 2:', e.message);
    }

    // Test 3: Convert Intent Detection
    console.log('\n[TEST 3] Convert Intent...');
    try {
        const res = await fetch(BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: USER_ID,
                userRole: ROLE,
                userMessage: 'Convert lead 9876543210 to patient'
            })
        });
        const text = await res.text();
        try {
            const json = JSON.parse(text);
            console.log('Status:', res.status);
            console.log('Response:', JSON.stringify(json, null, 2));
        } catch {
            console.log('Status:', res.status);
            console.log('Response (Text):', text);
        }

    } catch (e) {
        console.error('Failed Test 3:', e.message);
    }

    console.log('=== END VERIFICATION ===');
}

verify();
