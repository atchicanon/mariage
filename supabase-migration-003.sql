-- Migration 003 : configuration des tables dans Supabase

ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS tables_config jsonb DEFAULT '[]'::jsonb;
