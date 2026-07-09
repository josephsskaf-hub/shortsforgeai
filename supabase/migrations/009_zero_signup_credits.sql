-- KINEO-ZERO-SIGNUP-2026-07-09 — InVideo model: new signups start with 0
-- video_credits. Fast renders are FREE to generate/watch (watermarked);
-- monetization happens at the $4.90 download unlock (KINEO-DL-PAYWALL) or via
-- plans. ONLY affects NEW signups — existing users keep their balances.
--
-- ⚠️ DEPLOY ORDER: apply this AFTER the code deploy (push_zero_signup.bat).
-- If applied first, new users would get 0 credits while the old 402 Fast wall
-- is still live in prod → they couldn't generate anything at all.

-- 1) New-user trigger: was video_credits = 2
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
begin
  insert into public.profiles (id, email, video_credits, free_ai_generate_used)
  values (new.id, new.email, 0, true)
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- 2) Column default (legacy path, was 3): any profiles row created outside the
-- trigger also starts at 0.
alter table public.profiles alter column video_credits set default 0;
