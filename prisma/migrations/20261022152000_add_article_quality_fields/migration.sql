-- AlterTable
ALTER TABLE "articles"
ADD COLUMN "quality_data" JSONB,
ADD COLUMN "quality_score" INTEGER,
ADD COLUMN "revision_count" INTEGER NOT NULL DEFAULT 0;
