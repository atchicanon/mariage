-- Migration 001 : groupes d'invités + budget global + adresse mariage

ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS group_name text;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS total_budget numeric default 0;
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS address text;
