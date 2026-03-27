-- 1. Enable UUID Extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create the Knowledge Nodes Table (Hierarchical Final Storage)
-- This table MUST be created first because failure_logs references it.
CREATE TABLE public.knowledge_nodes (
    node_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES knowledge_nodes(node_id) ON DELETE CASCADE,
    node_level TEXT NOT NULL CHECK (node_level IN ('course', 'module', 'topic', 'section', 'content')),
    title TEXT NOT NULL,
    content TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    course_id UUID, -- Optional denormalization to easily fetch all nodes in a course
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
) TABLESPACE pg_default;

-- Create indexes for fast hierarchical lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_parent_id ON public.knowledge_nodes USING btree (parent_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_level ON public.knowledge_nodes USING btree (node_level) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_course_id ON public.knowledge_nodes USING btree (course_id) TABLESPACE pg_default;

-- 3. Create the Failure Logs Table (Staging + Structured Input)
CREATE TABLE public.failure_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_query TEXT NOT NULL,
    similarity_score NUMERIC NOT NULL,
    retrieved_context TEXT NULL,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    metadata JSONB NULL DEFAULT '{}'::jsonb, -- This is where the {"structured_answer": {...}} goes
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ NULL,
    resolved_node_id UUID NULL,
    
    -- Foreign key to link back to the leaf content node
    CONSTRAINT failure_logs_resolved_node_id_fkey FOREIGN KEY (resolved_node_id) REFERENCES public.knowledge_nodes(node_id) ON DELETE SET NULL,
    
    -- Status constraint matching our JS enums
    CONSTRAINT failure_logs_status_check CHECK (
        status = ANY (ARRAY['pending'::text, 'resolved'::text, 'draft'::text, 'dismissed'::text])
    )
) TABLESPACE pg_default;

-- Create indexes to make the Expert Query Dashboard fast
CREATE INDEX IF NOT EXISTS idx_failure_logs_similarity ON public.failure_logs USING btree (similarity_score) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_failure_logs_status ON public.failure_logs USING btree (status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_failure_logs_created_at ON public.failure_logs USING btree (created_at) TABLESPACE pg_default;

-- 4. Trigger to auto-update the 'updated_at' timestamp (Optional but recommended)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_failure_logs_modtime
    BEFORE UPDATE ON public.failure_logs
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_knowledge_nodes_modtime
    BEFORE UPDATE ON public.knowledge_nodes
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
