-- CreateTable
CREATE TABLE "blog_topic_focus" (
    "id" TEXT NOT NULL,
    "website_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "focus_topic" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "angle" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" DATE,
    "end_date" DATE,
    "notes" TEXT,
    "last_used_at" TIMESTAMP(3),
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_topic_focus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blog_topic_focus_website_id_idx" ON "blog_topic_focus"("website_id");

-- CreateIndex
CREATE INDEX "blog_topic_focus_active_idx" ON "blog_topic_focus"("active");

-- CreateIndex
CREATE INDEX "blog_topic_focus_start_date_end_date_idx" ON "blog_topic_focus"("start_date", "end_date");

-- AddForeignKey
ALTER TABLE "blog_topic_focus"
ADD CONSTRAINT "blog_topic_focus_website_id_fkey"
FOREIGN KEY ("website_id") REFERENCES "websites"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
