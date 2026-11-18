-- CreateTable
CREATE TABLE "short_links" (
    "code" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "url_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "short_links_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "short_links_url_hash_key" ON "short_links"("url_hash");
