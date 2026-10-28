UPDATE "image_assets"
SET "selection_ready" = true
WHERE cardinality("keywords") > 0
  AND "selection_ready" = false;
