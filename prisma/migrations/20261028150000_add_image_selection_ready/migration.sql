ALTER TABLE "image_assets"
ADD COLUMN "selection_ready" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "image_assets_selection_ready_idx"
ON "image_assets"("selection_ready");
