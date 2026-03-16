
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Simple .env parser since dotenv is missing
function loadEnv() {
    try {
        const paths = ['.env', '.env.local'];
        paths.forEach(path => {
            if (fs.existsSync(path)) {
                console.log(`Loading ${path}...`);
                const content = fs.readFileSync(path, 'utf8');
                content.split('\n').forEach(line => {
                    const match = line.match(/^\s*([\w]+)\s*=\s*(.*)?\s*$/);
                    if (match) {
                        const key = match[1];
                        let value = match[2] || '';
                        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                            value = value.slice(1, -1);
                        }
                        process.env[key] = value.trim();
                    }
                });
            }
        });
    } catch (err) {
        console.error('Error loading env:', err);
    }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.log('Available Env Vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
    console.log('Inspecting sakhi_clinic_leads...');
    const { data, error } = await supabase
        .from('sakhi_clinic_leads')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching leads:', error);
    } else {
        if (data && data.length > 0) {
            console.log('COLUMNS_JSON:');
            console.log(JSON.stringify(Object.keys(data[0]), null, 2));
        } else {
            console.log('Table is empty.');
        }
    }
}

inspectSchema();
