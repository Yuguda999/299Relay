-- 299 RELAY — new job type: print (documents printed at a business centre).
-- Kept in its own migration: a new enum value must be committed before use.
alter type public.request_type add value if not exists 'print';
