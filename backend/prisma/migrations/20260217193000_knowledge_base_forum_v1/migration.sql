DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_ARTICLE_CREATED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_ARTICLE_UPDATED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_COMMENT_CREATED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "galleryImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeComment" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeArticle_slug_key" ON "KnowledgeArticle"("slug");
CREATE INDEX "KnowledgeArticle_isPublished_createdAt_idx" ON "KnowledgeArticle"("isPublished", "createdAt");
CREATE INDEX "KnowledgeArticle_authorId_createdAt_idx" ON "KnowledgeArticle"("authorId", "createdAt");
CREATE INDEX "KnowledgeArticle_title_idx" ON "KnowledgeArticle"("title");
CREATE INDEX "KnowledgeComment_articleId_createdAt_idx" ON "KnowledgeComment"("articleId", "createdAt");
CREATE INDEX "KnowledgeComment_authorId_createdAt_idx" ON "KnowledgeComment"("authorId", "createdAt");

ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeComment" ADD CONSTRAINT "KnowledgeComment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeComment" ADD CONSTRAINT "KnowledgeComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

