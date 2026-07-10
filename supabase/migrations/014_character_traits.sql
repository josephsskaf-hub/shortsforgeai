-- KINEO-CHARLOCK-V2-2026-07-10 — Character Lock v2 (briefing Upwork, validado
-- com contrato pago do Rick): coluna `traits` guarda os traços fixos do
-- personagem ("bald, white goatee, rimless glasses") extraídos por vision na
-- hora do save. Eles são injetados no prompt do images.edit ("same face, same
-- <traits>...") — regra aprendida no job: repetir os traços explicitamente
-- reduz drift de identidade.
alter table public.characters
  add column if not exists traits text;
