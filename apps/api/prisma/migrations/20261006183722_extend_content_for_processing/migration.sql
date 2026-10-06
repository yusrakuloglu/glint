-- CreateEnum
CREATE TYPE "ProcessingStep" AS ENUM ('EXTRACT', 'SUMMARIZE', 'CHUNK', 'EMBED', 'DONE');

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('GEMINI', 'GROQ');

-- AlterTable
ALTER TABLE "contents" ADD COLUMN     "ai_provider" "AiProvider",
ADD COLUMN     "article_html" TEXT,
ADD COLUMN     "byline" TEXT,
ADD COLUMN     "content_hash" TEXT,
ADD COLUMN     "excerpt" TEXT,
ADD COLUMN     "failure_reason" TEXT,
ADD COLUMN     "processing_step" "ProcessingStep" NOT NULL DEFAULT 'EXTRACT',
ADD COLUMN     "status_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "suggested_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "text" TEXT,
ADD COLUMN     "word_count" INTEGER,
ALTER COLUMN "status" SET DEFAULT 'AWAITING_CONTENT';

-- CreateTable
CREATE TABLE "page_snapshots" (
    "id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "html" TEXT NOT NULL,
    "lang" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("user_id","day")
);

-- CreateIndex
CREATE INDEX "page_snapshots_content_id_created_at_idx" ON "page_snapshots"("content_id", "created_at");

-- CreateIndex
CREATE INDEX "contents_status_status_changed_at_idx" ON "contents"("status", "status_changed_at");

-- AddForeignKey
ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: no job was ever queued for existing PENDING rows (the queue did
-- not exist yet), so they are waiting for page content.
UPDATE "contents" SET "status" = 'AWAITING_CONTENT' WHERE "status" = 'PENDING';

-- Hand-written: Prisma schema cannot express CHECK constraints.
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_count_check" CHECK ("count" >= 0);
