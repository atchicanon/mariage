-- Migration 002 : indicateur enfant sur les invités

ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS is_child boolean NOT NULL DEFAULT false;
