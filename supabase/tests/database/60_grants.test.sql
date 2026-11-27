-- No public function is callable by anon except the two RLS helpers.
begin;
select plan(2);
select is_empty($$
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('is_admin', 'my_campus')
$$, 'anon can execute only is_admin and my_campus');
select is_empty($$
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'svc\_%' and has_function_privilege('authenticated', p.oid, 'execute')
$$, 'svc_* functions are service-role only');
select * from finish();
rollback;
