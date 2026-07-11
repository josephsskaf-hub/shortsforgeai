-- KINEO-OWN-VOICE-2026-07-10 — Prioridade 3 (cliente $200/mês: "need to add
-- my own voice"). Persiste o voice_id do clone (MiniMax via fal) no perfil:
-- clonou uma vez no Avatar Studio → TODA geração (Fast/AI) pode narrar com a
-- voz do usuário. Antes o id vivia só no estado do navegador.
alter table public.profiles
  add column if not exists voice_clone_id text;
