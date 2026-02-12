
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

function loadEnv() {
    try {
        const paths = ['.env', '.env.local'];
        paths.forEach(path => {
            if (fs.existsSync(path)) {
                const content = fs.readFileSync(path, 'utf8');
                content.split('\n').forEach(line => {
                    const match = line.match(/^\s*([\w]+)\s*=\s*(.*)?\s*$/);
                    if (match) {
                        let val = match[2] || '';
                        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
                        process.env[match[1]] = val.trim();
                    }
                });
            }
        });
    } catch (err) { }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!supabaseUrl || !supabaseKey || !JWT_SECRET) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLeadsPost() {
    const token = jwt.sign({ sub: 'test-user-id', email: 'test@example.com', role: 'admin' }, JWT_SECRET);

    const newLead = {
        name: "Test Patient " + Date.now(),
        phone: "9999999999",
        husband_or_guardian_name: "Test Guardian", // Exact key from frontend
        // guardian_age: "45", // This one seemed correct in logs (husband_age was logged as map to guardian_age?) Wait, logs showed "husband_age".
        // Let's check logs again. 
        // Logs: Unmapped: "husband_age" -> "husband_age"
        // My mapping has: 'husbandage': 'guardian_age'
        // So "husband_age" should map to 'guardian_age' if I have 'husband_age' in mapping.
        // I added: 'husband age': 'guardian_age'. I should check if snake_case is there.
        // existing: 'husbandage', 'HusbandAge'.. 
        // I should add 'husband_age': 'guardian_age' explicitly to be safe.

        husband_age: "45", // Using what frontend sent
        location: "Test City",
        alternative_phone_number: "8888888888", // Exact key from frontend
        referral_required: "Yes"
    };

    try {
        const response = await fetch('http://localhost:3200/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(newLead)
        });

        const result = await response.json();

        if (result.success) {
            const { data, error } = await supabase.from('sakhi_clinic_leads').select('*').eq('id', result.data.id).single();
            if (data) {
                console.log('RECORD:' + JSON.stringify(data));
            } else {
                console.log('ERROR: Record not found');
            }
        } else {
            console.log('ERROR: API Failed ' + JSON.stringify(result));
        }
    } catch (error) {
        console.log('ERROR: Exception ' + error.message);
    }
}

testLeadsPost();
