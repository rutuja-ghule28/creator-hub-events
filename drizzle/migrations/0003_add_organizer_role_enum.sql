-- Creator Connect Migration: Extend app_role enum for organizer
-- Version: 0003
-- Date: 2026-11-18

-- Standalone enum migration:
-- In PostgreSQL, ALTER TYPE ... ADD VALUE cannot be executed in the same transaction
-- block as subsequent statements that reference the new enum value.
-- This migration runs independently and commits the new 'organizer' enum value.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'organizer';
