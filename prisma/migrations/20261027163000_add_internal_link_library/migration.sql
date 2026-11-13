-- CreateEnum
CREATE TYPE "InternalLinkSource" AS ENUM ('MANUAL', 'WORDPRESS');

-- CreateTable
CREATE TABLE "internal_links" (
    "id" TEXT NOT NULL,
    "website_id" TEXT NOT NULL,
    "page_title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "target_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "anchor_suggestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "content_type" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" "InternalLinkSource" NOT NULL DEFAULT 'MANUAL',
    "wordpress_object_id" INTEGER,
    "wordpress_object_type" TEXT,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_internal_links" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "internal_link_id" TEXT NOT NULL,
    "anchor_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_internal_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_links_website_id_url_key"
ON "internal_links"("website_id", "url");

CREATE INDEX "internal_links_website_id_idx" ON "internal_links"("website_id");
CREATE INDEX "internal_links_active_idx" ON "internal_links"("active");
CREATE INDEX "internal_links_source_idx" ON "internal_links"("source");

CREATE UNIQUE INDEX "article_internal_links_article_id_internal_link_id_key"
ON "article_internal_links"("article_id", "internal_link_id");

CREATE INDEX "article_internal_links_article_id_idx"
ON "article_internal_links"("article_id");

CREATE INDEX "article_internal_links_internal_link_id_idx"
ON "article_internal_links"("internal_link_id");

-- AddForeignKey
ALTER TABLE "internal_links"
ADD CONSTRAINT "internal_links_website_id_fkey"
FOREIGN KEY ("website_id") REFERENCES "websites"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article_internal_links"
ADD CONSTRAINT "article_internal_links_article_id_fkey"
FOREIGN KEY ("article_id") REFERENCES "articles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article_internal_links"
ADD CONSTRAINT "article_internal_links_internal_link_id_fkey"
FOREIGN KEY ("internal_link_id") REFERENCES "internal_links"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
