-- 299 RELAY — receipts are optional. Many campus vendors and business centres
-- don't give receipts, so the traveler confirms the amount spent (which returns
-- unused budget to the requester) and may attach a receipt photo if they have one.

CREATE OR REPLACE FUNCTION public.confirm_purchase(p_job uuid, p_receipt_path text, p_receipt_amount bigint)
 RETURNS jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  me    public.profiles := private.me();
  v_job public.jobs;
  v_req public.requests;
begin
  select * into v_job from jobs where id = p_job for update;
  if not found or v_job.traveler_id <> me.id then perform private.err('job_not_found'); end if;
  select * into v_req from requests where id = v_job.request_id;
  if v_req.type not in ('buy', 'print') then perform private.err('not_a_buy_job'); end if;
  -- Receipts are optional: many campus vendors don't give one. The amount is what matters.
  if p_receipt_path is not null and split_part(p_receipt_path, '/', 1) <> me.id::text then
    perform private.err('invalid_upload_path');
  end if;
  if p_receipt_amount is null or p_receipt_amount <= 0 then perform private.err('invalid_amount'); end if;
  if p_receipt_amount > v_job.advance_amount then
    perform private.err('over_budget', 'ask the requester to approve the new price in chat first');
  end if;

  -- Unused budget goes back to the requester straight away.
  perform private.transfer(gen_random_uuid(), private.user_account(me.id), private.user_account(v_job.requester_id),
                           v_job.advance_amount - p_receipt_amount, 'unused_budget', v_job.request_id, v_job.id);

  update jobs set receipt_path = nullif(p_receipt_path, ''), receipt_amount = p_receipt_amount where id = p_job;
  v_job := private.set_job_status(p_job, 'purchased', me.id, format('%s for %s', case when v_req.type = 'print' then 'Printed' else 'Bought' end, private.naira(p_receipt_amount)));
  perform private.system_message(p_job, format('%s for %s.%s', case when v_req.type = 'print' then 'Printed' else 'Item bought' end, private.naira(p_receipt_amount),
           case when nullif(p_receipt_path, '') is not null then ' Receipt uploaded.' else ' No receipt.' end));
  perform private.notify(v_job.requester_id, 'job_purchased', case when v_req.type = 'print' then 'Your documents were printed' else 'Your item was bought' end,
    format('Spent: %s.', private.naira(p_receipt_amount)), '/jobs/' || p_job);
  return v_job;
end $function$

;

CREATE OR REPLACE FUNCTION public.start_delivery(p_job uuid)
 RETURNS jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  me    public.profiles := private.me();
  v_job public.jobs;
  v_type public.request_type;
begin
  select * into v_job from jobs where id = p_job;
  if not found or v_job.traveler_id <> me.id then perform private.err('job_not_found'); end if;
  select type into v_type from requests where id = v_job.request_id;
  if v_type in ('buy', 'print') and v_job.status <> 'purchased' then
    perform private.err('purchase_first', 'confirm what you spent before heading to the handoff');
  end if;
  v_job := private.set_job_status(p_job, 'in_transit', me.id, 'On the way');
  perform private.notify(v_job.requester_id, 'job_in_transit', 'On the way', 'Have your handoff code ready.', '/jobs/' || p_job);
  return v_job;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_handoff_code(p_job uuid, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  me     public.profiles := private.me();
  v_job  public.jobs;
  v_req  public.requests;
  v_real text;
  v_comm bigint;
  v_txn  uuid := gen_random_uuid();
  v_escrow uuid;
  v_left bigint;
begin
  select * into v_job from jobs where id = p_job for update;
  if not found or v_job.traveler_id <> me.id then perform private.err('job_not_found'); end if;
  if v_job.status not in ('accepted', 'purchased', 'in_transit') then
    perform private.err('invalid_status_change', format('job is %s', v_job.status));
  end if;
  select * into v_req from requests where id = v_job.request_id;
  if v_req.type in ('buy', 'print') and v_job.status = 'accepted' then
    perform private.err('purchase_first', 'confirm what you spent before handing off');
  end if;

  select code into v_real from job_handoff_codes where job_id = p_job;
  if p_code is distinct from v_real then
    update jobs set code_attempts = code_attempts + 1 where id = p_job returning * into v_job;
    if v_job.code_attempts >= 5 then
      perform private.set_job_status(p_job, 'disputed', null, 'Too many wrong handoff codes');
      insert into disputes (job_id, reporter_id, reason, details)
      values (p_job, null, 'code_lockout', 'Locked after 5 wrong handoff codes.');
      perform private.notify(v_job.requester_id, 'dispute_opened', 'Handoff locked',
        'Too many wrong codes were entered. An admin will review this job.', '/jobs/' || p_job);
      perform private.notify(me.id, 'dispute_opened', 'Handoff locked',
        'Too many wrong codes were entered. An admin will review this job.', '/jobs/' || p_job);
      return jsonb_build_object('ok', false, 'attempts_left', 0, 'locked', true);
    end if;
    return jsonb_build_object('ok', false, 'attempts_left', 5 - v_job.code_attempts, 'locked', false);
  end if;

  -- Release the fee: traveler gets fee − commission, platform gets commission.
  v_comm := private.commission(v_req.fee);
  v_escrow := private.escrow_account(v_req.id);
  perform private.transfer(v_txn, v_escrow, private.user_account(me.id), v_req.fee - v_comm, 'delivery_fee', v_req.id, p_job);
  perform private.transfer(v_txn, v_escrow, private.system_account('platform_revenue'), v_comm, 'commission', v_req.id, p_job);
  -- Anything still held (should be zero) returns to the requester.
  select balance into v_left from ledger_accounts where id = v_escrow;
  if v_left > 0 then
    perform private.refund_escrow(v_req.id, p_job, 'escrow_remainder');
  end if;

  v_job := private.set_job_status(p_job, 'completed', me.id, 'Handoff code confirmed');
  update requests set status = 'completed' where id = v_req.id;
  update profiles set jobs_carried = jobs_carried + 1 where id = me.id;
  update profiles set jobs_requested = jobs_requested + 1 where id = v_job.requester_id;
  if v_job.trip_id is not null then
    update trips set slots_taken = slots_taken - 1,
                     status = case when status = 'full' then 'live' else status end
     where id = v_job.trip_id and status in ('live', 'full');
  end if;

  perform private.system_message(p_job, 'Delivered. Thanks for using 299 RELAY.');
  perform private.notify(v_job.requester_id, 'job_completed', 'Delivered', 'Rate your traveler.', '/jobs/' || p_job);
  perform private.notify(me.id, 'job_completed', 'Job complete',
    format('%s added to your wallet.', private.naira(v_req.fee - v_comm)), '/jobs/' || p_job, true);
  return jsonb_build_object('ok', true, 'attempts_left', 5 - v_job.code_attempts, 'locked', false,
                            'earned', v_req.fee - v_comm, 'job', to_jsonb(v_job));
end $function$
;


