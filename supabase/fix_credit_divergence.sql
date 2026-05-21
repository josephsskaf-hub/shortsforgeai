-- ============================================================
-- Diagnóstico e correção da divergência de créditos
-- Conta: josephskaf@hotmail.com
-- Data: 2026-05-21
-- Push: fix-double-deduction
--
-- Execute no Supabase SQL editor (service-role context).
-- Lê o estado atual, detecta possíveis double-deductions
-- via a tabela videos, e reporta/corrige o saldo.
-- ============================================================

-- 1) Ver saldo atual e info do perfil
SELECT
  id,
  email,
  video_credits,
  plan,
  is_pro,
  cinematic_tokens,
  created_at
FROM profiles
WHERE email = 'josephskaf@hotmail.com';

-- 2) Contar vídeos gerados (para estimar quantos créditos foram usados)
SELECT
  COUNT(*) AS total_videos,
  SUM(CASE WHEN status = 'completed' THEN credits_used ELSE 0 END) AS total_credits_used,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_videos,
  SUM(CASE WHEN quality = 'fast' THEN 1 ELSE 0 END) AS fast_mode_videos
FROM videos
WHERE user_id = (SELECT id FROM profiles WHERE email = 'josephskaf@hotmail.com');

-- 3) Ver últimos vídeos com render_id para detectar duplicatas
-- (double-deduction acontece quando o mesmo render_id tem múltiplas linhas)
SELECT
  render_id,
  COUNT(*) AS duplicate_count,
  MAX(created_at) AS last_created
FROM videos
WHERE user_id = (SELECT id FROM profiles WHERE email = 'josephskaf@hotmail.com')
  AND render_id IS NOT NULL
GROUP BY render_id
HAVING COUNT(*) > 1;

-- 4) Ver últimas 20 gerações para auditoria
SELECT
  id,
  status,
  quality,
  credits_used,
  render_id,
  created_at
FROM videos
WHERE user_id = (SELECT id FROM profiles WHERE email = 'josephskaf@hotmail.com')
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================
-- CORREÇÃO: Restaurar créditos se houver double-deduction
-- Descomente e ajuste o número abaixo se necessário.
-- O número correto = saldo_esperado (verificar manualmente
-- contando: créditos_iniciais - videos_completados).
-- ============================================================

-- UPDATE profiles
-- SET video_credits = <SALDO_CORRETO>
-- WHERE email = 'josephskaf@hotmail.com';
