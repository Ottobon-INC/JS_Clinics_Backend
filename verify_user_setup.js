const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  console.log('Checking sakhi_clinic_users table...');
  const { data, error } = await supabase
    .from('sakhi_clinic_users')
    .select('*');

  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('Users found in sakhi_clinic_users:', data);
  }
}

checkUsers();
