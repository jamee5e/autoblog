-- CreateEnum
CREATE TYPE "ScheduledJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduledJobAction" AS ENUM ('GENERATE_ONLY', 'GENERATE_AND_DRAFT');

-- CreateTable
CREATE TABLE "scheduled_jobs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "website_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "article_id" TEXT,
    "topic" TEXT NOT NULL,
    "primary_keyword" TEXT NOT NULL,
    "additional_instructions" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "action" "ScheduledJobAction" NOT NULL DEFAULT 'GENERATE_AND_DRAFT',
    "status" "ScheduledJobStatus" NOT NULL DEFAULT 'PENDING',
    "last_error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_jobs_article_id_key" ON "scheduled_jobs"("article_id");

-- CreateIndex
CREATE INDEX "scheduled_jobs_company_id_idx" ON "scheduled_jobs"("company_id");

-- CreateIndex
CREATE INDEX "scheduled_jobs_website_id_idx" ON "scheduled_jobs"("website_id");

-- CreateIndex
CREATE INDEX "scheduled_jobs_status_scheduled_at_idx" ON "scheduled_jobs"("status", "scheduled_at");

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
