-- Off-campus towns and neighbourhoods around Zaria (Samaru, PZ, Zango…).
-- Separate migration: a new enum value can't be used in the transaction that adds it.
alter type public.place_kind add value if not exists 'area';
