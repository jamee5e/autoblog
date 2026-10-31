-- CreateEnum
CREATE TYPE "ArticleImageRole" AS ENUM ('FEATURED', 'INLINE');

-- CreateTable
CREATE TABLE "image_assets" (
    "id" TEXT NOT NULL,
    "website_id" TEXT NOT NULL,
    "wordpress_media_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "alt_text" TEXT,
    "caption" TEXT,
    "description" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mime_type" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_images" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "image_asset_id" TEXT NOT NULL,
    "role" "ArticleImageRole" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "alt_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "image_assets_website_id_wordpress_media_id_key"
ON "image_assets"("website_id", "wordpress_media_id");

CREATE INDEX "image_assets_website_id_idx" ON "image_assets"("website_id");
CREATE INDEX "image_assets_active_idx" ON "image_assets"("active");

CREATE UNIQUE INDEX "article_images_article_id_image_asset_id_key"
ON "article_images"("article_id", "image_asset_id");

CREATE INDEX "article_images_article_id_role_sort_order_idx"
ON "article_images"("article_id", "role", "sort_order");

-- AddForeignKey
ALTER TABLE "image_assets"
ADD CONSTRAINT "image_assets_website_id_fkey"
FOREIGN KEY ("website_id") REFERENCES "websites"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article_images"
ADD CONSTRAINT "article_images_article_id_fkey"
FOREIGN KEY ("article_id") REFERENCES "articles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article_images"
ADD CONSTRAINT "article_images_image_asset_id_fkey"
FOREIGN KEY ("image_asset_id") REFERENCES "image_assets"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
