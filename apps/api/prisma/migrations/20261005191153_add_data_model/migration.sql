-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "TagSource" AS ENUM ('USER', 'AI');

-- CreateEnum
CREATE TYPE "HighlightColor" AS ENUM ('YELLOW', 'GREEN', 'BLUE', 'PINK', 'PURPLE');

-- CreateTable
CREATE TABLE "contents" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "site_name" TEXT,
    "summary" TEXT,
    "language" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_links" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "original_url" TEXT NOT NULL,
    "title" TEXT,
    "note" TEXT,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "saved_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunks" (
    "id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL,
    "embedding" vector(384),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_link_tags" (
    "user_id" UUID NOT NULL,
    "saved_link_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "source" "TagSource" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_link_tags_pkey" PRIMARY KEY ("saved_link_id","tag_id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_items" (
    "user_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "saved_link_id" UUID NOT NULL,
    "position" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_items_pkey" PRIMARY KEY ("collection_id","saved_link_id")
);

-- CreateTable
CREATE TABLE "highlights" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "saved_link_id" UUID NOT NULL,
    "quote" TEXT NOT NULL,
    "selector" JSONB NOT NULL,
    "color" "HighlightColor" NOT NULL DEFAULT 'YELLOW',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "highlights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contents_url_key" ON "contents"("url");

-- CreateIndex
CREATE INDEX "saved_links_user_id_created_at_id_idx" ON "saved_links"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "saved_links_user_id_content_id_key" ON "saved_links"("user_id", "content_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_links_id_user_id_key" ON "saved_links"("id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "chunks_content_id_index_key" ON "chunks"("content_id", "index");

-- CreateIndex
CREATE UNIQUE INDEX "tags_user_id_slug_key" ON "tags"("user_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_id_user_id_key" ON "tags"("id", "user_id");

-- CreateIndex
CREATE INDEX "saved_link_tags_tag_id_idx" ON "saved_link_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "collections_user_id_name_key" ON "collections"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "collections_id_user_id_key" ON "collections"("id", "user_id");

-- CreateIndex
CREATE INDEX "collection_items_saved_link_id_idx" ON "collection_items"("saved_link_id");

-- CreateIndex
CREATE INDEX "highlights_saved_link_id_idx" ON "highlights"("saved_link_id");

-- AddForeignKey
ALTER TABLE "saved_links" ADD CONSTRAINT "saved_links_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_link_tags" ADD CONSTRAINT "saved_link_tags_saved_link_id_user_id_fkey" FOREIGN KEY ("saved_link_id", "user_id") REFERENCES "saved_links"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_link_tags" ADD CONSTRAINT "saved_link_tags_tag_id_user_id_fkey" FOREIGN KEY ("tag_id", "user_id") REFERENCES "tags"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_user_id_fkey" FOREIGN KEY ("collection_id", "user_id") REFERENCES "collections"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_saved_link_id_user_id_fkey" FOREIGN KEY ("saved_link_id", "user_id") REFERENCES "saved_links"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_saved_link_id_user_id_fkey" FOREIGN KEY ("saved_link_id", "user_id") REFERENCES "saved_links"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: Prisma schema cannot express CHECK constraints.
-- Normalized URLs are ASCII, so 2048 chars stays under the btree entry limit.
ALTER TABLE "contents" ADD CONSTRAINT "contents_url_length_check" CHECK (char_length("url") <= 2048);
