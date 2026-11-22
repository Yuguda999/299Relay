-- 299 RELAY — Paystack customer and dedicated virtual account per student.
-- Bank-transfer top-ups land in the student's own virtual account; the
-- webhook maps customer_code back to the profile.

create table public.paystack_customers (
  profile_id          uuid primary key references public.profiles(id) on delete cascade,
  customer_code       text not null unique,
  account_number      text,
  account_name        text,
  bank_name           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger touch_updated_at before update on public.paystack_customers
  for each row execute function private.touch_updated_at();

alter table public.paystack_customers enable row level security;
create policy paystack_customers_read on public.paystack_customers for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
grant select on public.paystack_customers to authenticated;

create or replace function public.svc_save_paystack_customer(
  p_profile uuid, p_customer_code text, p_account_number text, p_account_name text, p_bank_name text
) returns public.paystack_customers
language sql security definer set search_path = public, extensions as $$
  insert into paystack_customers (profile_id, customer_code, account_number, account_name, bank_name)
  values (p_profile, p_customer_code, p_account_number, p_account_name, p_bank_name)
  on conflict (profile_id) do update
    set customer_code  = excluded.customer_code,
        account_number = coalesce(excluded.account_number, paystack_customers.account_number),
        account_name   = coalesce(excluded.account_name, paystack_customers.account_name),
        bank_name      = coalesce(excluded.bank_name, paystack_customers.bank_name)
  returning *;
$$;

create or replace function public.svc_profile_for_customer(p_customer_code text) returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select profile_id from paystack_customers where customer_code = p_customer_code;
$$;

revoke execute on function public.svc_save_paystack_customer(uuid, text, text, text, text),
                           public.svc_profile_for_customer(text) from public, anon, authenticated;
grant execute on function public.svc_save_paystack_customer(uuid, text, text, text, text),
                          public.svc_profile_for_customer(text) to service_role;
