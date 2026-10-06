-- Hand-written: snapshots are transient and SQL cannot gzip existing rows.
-- Content waiting on a dropped snapshot goes back to waiting for page
-- content; any queued extract job then finds no snapshot.
UPDATE "contents" SET
  "status" = 'AWAITING_CONTENT',
  "processing_step" = 'EXTRACT',
  "status_changed_at" = CURRENT_TIMESTAMP
WHERE "status" = 'PENDING'
  AND "id" IN (SELECT "content_id" FROM "page_snapshots");

DELETE FROM "page_snapshots";

-- AlterTable
ALTER TABLE "page_snapshots" DROP COLUMN "html",
ADD COLUMN     "html_gzip" BYTEA NOT NULL;
