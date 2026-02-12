
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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

if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyLastLead() {
    // Get the most recent lead
    const { data, error } = await supabase
        .from('sakhi_clinic_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        console.log('ERROR: Could not fetch last lead');
        return;
    }

    console.log('Checking Lead ID:', data.id);
    console.log('Guardian Name:', data.guardian_name === 'Test Guardian' ? 'PASS' : 'FAIL (' + data.guardian_name + ')');
    console.log('Guardian Age:', (data.guardian_age == 45) ? 'PASS' : 'FAIL (' + data.guardian_age + ')');
    console.log('Location:', data.location === 'Test City' ? 'PASS' : 'FAIL (' + data.location + ')');
    console.log('Alt Phone:', data.alternate_phone === '8888888888' ? 'PASS' : 'FAIL (' + data.alternate_phone + ')');
    console.log('Referral Req:', (data.referral_required === true) ? 'PASS' : 'FAIL (' + data.referral_required + ')');
}

verifyLastLead();
