const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase URL or Key in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("🧪 Starting Test: Structured Expert Answers");
  
  // 1. Setup Phase: Create a dummy failure log
  console.log("\n[1] Creating dummy failure log...");
  const dummyQuery = "Why do my joints hurt when the weather changes?";
  
  const { data: logData, error: logError } = await supabase
    .from('failure_logs')
    .insert({
      user_query: dummyQuery,
      similarity_score: 0.42,
      status: 'pending'
    })
    .select()
    .single();

  if (logError) {
    console.error("❌ Failed to create setup data:", logError.message);
    process.exit(1);
  }

  const queryId = logData.id;
  console.log(`✅ Dummy log created: ${queryId}`);

  // 2. Test Phase: Ping the new API
  console.log("\n[2] Pinging POST /api/expert/answer...");
  
  const payload = {
    query_id: queryId,
    answer: "Weather changes affect barometric pressure, which can cause tissue expansion and joint pain in sensitive individuals.",
    category: {
      course: "General Medicine",
      module: "Rheumatology",
      topic: "Joint Pain",
      section: "Environmental Triggers"
    },
    doctor_id: "test-doctor-123"
  };

  try {
    const response = await fetch('http://localhost:3000/api/expert/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const resJson = await response.json();
    console.log(`API Response Status: ${response.status}`);
    
    if (!response.ok) {
      console.error("❌ API call failed (Expected if not implemented yet):", resJson);
      throw new Error("API Route not implemented correctly");
    }
    
    console.log("✅ API call succeeded!");

    // 3. Verification Phase: Check failure_logs
    console.log("\n[3] Verifying failure_logs metadata...");
    const { data: updatedLog } = await supabase
      .from('failure_logs')
      .select('*')
      .eq('id', queryId)
      .single();

    if (updatedLog.status !== 'resolved') {
      throw new Error(`Expected status 'resolved', got '${updatedLog.status}'`);
    }

    const structuredAnswer = updatedLog.metadata?.structured_answer;
    if (!structuredAnswer || structuredAnswer.course !== "General Medicine") {
      throw new Error("structured_answer metadata is missing or incorrect in failure_logs");
    }
    
    if (!updatedLog.resolved_node_id) {
         throw new Error("resolved_node_id is missing");
    }

    console.log("✅ failure_logs successfully updated with structured metadata!");

    // 4. Verification Phase: Check knowledge_nodes
    console.log("\n[4] Verifying knowledge_nodes hierarchy...");
    
    // Check Content Leaf Node
    const { data: contentNode } = await supabase
      .from('knowledge_nodes')
      .select('*, parent_id:knowledge_nodes!parent_id(*)') // get parent section
      .eq('node_id', updatedLog.resolved_node_id)
      .single();

    if (!contentNode) {
      throw new Error("Leaf content node not found in knowledge_nodes");
    }
    
    if (contentNode.node_level !== 'content') {
        throw new Error("Leaf node level is not 'content'");
    }

    // Verify it links to a Section
    const sectionNode = contentNode.parent_id;
    if (!sectionNode || sectionNode.title !== "Environmental Triggers" || sectionNode.node_level !== "section") {
       throw new Error("Content node does not link to correct Section parent");
    }
    
    console.log("✅ Hierarchy verified successfully!");
    
    // Clean up
    console.log("\n[5] Cleaning up test data...");
    await supabase.from('failure_logs').delete().eq('id', queryId);
    
    console.log("\n🎉 ALL TESTS PASSED!");

  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error(error.message || error);
    
    // Cleanup on fail
    console.log("Cleaning up test data...");
    await supabase.from('failure_logs').delete().eq('id', queryId);
    process.exit(1);
  }
}

runTest();
