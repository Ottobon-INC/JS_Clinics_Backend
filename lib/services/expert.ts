import { getSupabaseAdmin } from '../supabase';

const supabase = getSupabaseAdmin();

export interface ExpertAnswerCategory {
  course: string;
  module: string;
  topic: string;
  section: string;
}

export interface ExpertAnswerPayload {
  query_id: string;
  answer: string;
  category: ExpertAnswerCategory;
  doctor_id?: string;
}

export class ExpertService {
  /**
   * Retrieves all failure logs that are pending
   */
  static async getQueries() {
    const { data, error } = await supabase
      .from('failure_logs')
      .select('id, user_query, similarity_score, created_at, status')
      .eq('status', 'pending')
      .order('similarity_score', { ascending: true });

    if (error) {
        throw error;
    }
    
    return data;
  }

  /**
   * Submits an expert answer:
   * 1. Updates failure_logs with the structured hierarchical metadata
   * 2. Sets status to 'resolved'
   */
  static async submitAnswer(payload: ExpertAnswerPayload) {
    console.log(`ExpertService: Processing answer for query ${payload.query_id}`);
    
    // 1. Fetch the failure log
    const { data: logData, error: logError } = await supabase
      .from('failure_logs')
      .select('user_query, status')
      .eq('id', payload.query_id)
      .single();
      
    if (logError || !logData) {
      throw new Error(`Failure log not found for ID: ${payload.query_id}`);
    }

    // Prepare structured metadata
    const structuredMetadata = {
        structured_answer: {
            ...payload.category,
            content: payload.answer
        },
        source: 'expert_dashboard',
        answered_by: payload.doctor_id || null
    };

    // 2. Update failure_logs securely with the jsonb structured answer
    try {
        console.log("ExpertService: Updating failure_logs...");
        const { error: updateError } = await supabase
            .from('failure_logs')
            .update({
                status: 'resolved',
                resolved_at: new Date().toISOString(),
                // Supabase merges top-level JSONB keys on update
                metadata: structuredMetadata
            })
            .eq('id', payload.query_id);

        if (updateError) throw updateError;

        console.log(`ExpertService: Successfully processed query ${payload.query_id}`);
        return { success: true };

    } catch (err: any) {
        console.error("ExpertService Error:", err);
        throw new Error(`Failed to update failure log: ${err.message}`);
    }
  }
}
