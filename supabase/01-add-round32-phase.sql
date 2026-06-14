-- Run this first in Supabase SQL Editor, by itself.
-- PostgreSQL requires enum changes to be committed before the new value is used.

alter type public.match_phase add value if not exists 'round32';
