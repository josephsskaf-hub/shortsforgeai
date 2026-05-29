-- 20260530_fix_critical_pipeline_bugs.sql
-- Atomic migration fixing critical video pipeline bugs.
-- Backup of deleted duplicate rows lives in videos_deleted_20260530_backup (PASSO 2A).

BEGIN;

-- Bug 2.1: adicionar render_id
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS render_id TEXT;

-- Bug 2.2: backfill render_id parseando o video_url
UPDATE videos
SET render_id = SUBSTRING(video_url FROM '([a-f0-9-]{36})\.mp4')
WHERE render_id IS NULL AND video_url IS NOT NULL;

-- Bug 2.3: DELETE duplicatas, mantendo a row mais antiga (menor created_at)
DELETE FROM videos
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY video_url ORDER BY created_at ASC) as rn
    FROM videos
    WHERE video_url IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Bug 2.4: índice único parcial pra prevenir futuro
CREATE UNIQUE INDEX IF NOT EXISTS videos_render_id_unique
ON videos(render_id)
WHERE render_id IS NOT NULL;

-- Bug 1: RLS policies faltantes em broll_metrics
CREATE POLICY "Users can insert own broll metrics"
ON broll_metrics FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own broll metrics"
ON broll_metrics FOR UPDATE
USING (auth.uid() = user_id);

-- Bug 3: remover default 'Untitled Short' se existir
ALTER TABLE videos
ALTER COLUMN topic DROP DEFAULT;

COMMIT;
