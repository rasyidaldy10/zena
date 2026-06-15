-- ============================================================
-- Izinkan jenis project custom (teks bebas).
-- Lepas CHECK constraint di kolom projects.type.
-- Jalankan SEKALI di Supabase SQL Editor.
-- ============================================================

DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
    FROM pg_constraint
   WHERE conrelid = 'public.projects'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%type%';
  IF c IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.projects DROP CONSTRAINT ' || quote_ident(c);
    RAISE NOTICE 'Dropped constraint: %', c;
  ELSE
    RAISE NOTICE 'Tidak ada CHECK constraint pada type (mungkin sudah dilepas).';
  END IF;
END $$;
