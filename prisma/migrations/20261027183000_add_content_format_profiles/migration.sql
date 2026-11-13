-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM (
  'AUTO',
  'LIST_GUIDE',
  'DESTINATION_GUIDE',
  'COMPARISON',
  'PLANNING_GUIDE'
);

-- AlterTable
ALTER TABLE "blog_topic_focus"
ADD COLUMN "content_format" "ContentFormat" NOT NULL DEFAULT 'AUTO',
ADD COLUMN "target_word_min" INTEGER NOT NULL DEFAULT 700,
ADD COLUMN "target_word_max" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN "suggested_sections" INTEGER;

-- AlterTable
ALTER TABLE "articles"
ADD COLUMN "content_format" "ContentFormat" NOT NULL DEFAULT 'AUTO',
ADD COLUMN "target_word_min" INTEGER NOT NULL DEFAULT 700,
ADD COLUMN "target_word_max" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN "suggested_sections" INTEGER;
