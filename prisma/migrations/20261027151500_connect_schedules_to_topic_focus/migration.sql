-- CreateEnum
CREATE TYPE "ScheduledContentSource" AS ENUM (
  'MANUAL',
  'TOPIC_FOCUS_AUTO',
  'TOPIC_FOCUS_SELECTED'
);

-- AlterTable
ALTER TABLE "scheduled_jobs"
ADD COLUMN "content_source" "ScheduledContentSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "topic_focus_id" TEXT,
ALTER COLUMN "topic" DROP NOT NULL,
ALTER COLUMN "primary_keyword" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "scheduled_jobs_topic_focus_id_idx"
ON "scheduled_jobs"("topic_focus_id");

-- AddForeignKey
ALTER TABLE "scheduled_jobs"
ADD CONSTRAINT "scheduled_jobs_topic_focus_id_fkey"
FOREIGN KEY ("topic_focus_id")
REFERENCES "blog_topic_focus"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
