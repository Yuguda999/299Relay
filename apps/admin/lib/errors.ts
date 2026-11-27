// Server error codes (private.err in SQL, AppError in Edge Functions) → copy.
const MESSAGES: Record<string, string> = {
  not_authenticated: "Your session ended. Log in again to continue.",
  already_decided: "This was already answered.",
  message_not_found: "That message is no longer available.",
  account_suspended: "Your account is suspended. Contact support.",
  not_verified: "Your student ID needs to be approved first.",
  insufficient_funds: "Not enough money in your wallet. Top up first.",
  already_taken: "Someone else took this one.",
  own_request: "You can't carry your own request.",
  own_trip: "You can't send a request to your own trip.",
  trip_full: "Your trip has no free slots.",
  trip_unavailable: "That trip is no longer taking requests.",
  trip_job_type: "This traveler isn't taking that kind of job.",
  unfinished_advance: "Finish your current buy job before taking another.",
  over_item_cap: "That's above your item limit.",
  over_budget: "The receipt is above the budget. Ask the requester to approve the new price in chat first.",
  purchase_first: "Confirm what you spent first.",
  deadline_too_soon: "Pick a time at least 15 minutes from now.",
  deadline_too_far: "Pick a time within the next 7 days.",
  after_curfew: "Handoffs must happen between 6:00am and 9:00pm.",
  not_a_handoff_point: "Pick a listed handoff point.",
  fee_below_suggested: "The fee can't be lower than the suggested fee.",
  fee_too_high: "The fee can't be more than ₦5,000.",
  budget_required: "Enter an item budget.",
  too_late_to_cancel: "The item is already bought. Report an issue instead.",
  too_late_to_release: "The job is already under way. Report an issue instead.",
  advance_spent: "The advance has already been used. Report an issue instead.",
  invalid_status_change: "This job can't do that right now.",
  dispute_already_open: "An issue is already open for this job.",
  dispute_window_closed: "Issues must be reported within 48 hours of delivery.",
  already_rated: "You've already rated this job.",
  rating_closed: "Ratings close 7 days after delivery.",
  matric_in_use: "This matric number is already linked to an account.",
  verification_pending: "Your ID is already in review.",
  invalid_matric: "Check your matric number.",
  below_minimum: "The minimum withdrawal is ₦1,000.",
  no_bank_account: "Add a bank account first.",
  payout_pending: "Wait for your last withdrawal to finish.",
  payout_failed: "The withdrawal failed. Your money is back in your wallet.",
  name_mismatch: "The account name must match your verified name.",
  invalid_account_number: "Enter a 10-digit account number.",
  dva_unavailable: "Bank transfer top-up isn't switched on yet. Use card or USSD for now.",
  payment_not_found: "We couldn't find that payment.",
  payment_provider_error: "Payments are unavailable right now. Try again shortly.",
  too_many_trips: "You can have at most 3 open trips.",
  invalid_time: "Check the departure and return times.",
  trip_has_active_jobs: "Finish or hand off the jobs already under way first.",
  "Invalid login credentials": "Wrong email or password.",
  "Email not confirmed": "Confirm your email first.",
  "User already registered": "An account with this email already exists. Log in instead.",
};

export function errorMessage(e: unknown): string {
  if (!e) return "Something went wrong.";
  const err = e as { message?: string; error?: string; code?: string };
  const key = err.error ?? err.message ?? String(e);
  // Requests made without a session are refused by Postgres grants (42501) or the API (JWT errors).
  if (err.code === "42501" || /permission denied|JWT expired|invalid JWT/i.test(key)) return MESSAGES.not_authenticated!;
  if (MESSAGES[key]) return MESSAGES[key];
  if (/token has expired|invalid/i.test(key) && /otp|token/i.test(key)) return "That code is wrong or expired.";
  if (/network|fetch/i.test(key)) return "No connection. Check your data and try again.";
  return "Something went wrong. Please try again.";
}
