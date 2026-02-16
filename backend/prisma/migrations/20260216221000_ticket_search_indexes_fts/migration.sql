-- Enable trigram index operator support for ILIKE/contains search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- B-tree indexes for common server-side filtering and ordering.
CREATE INDEX IF NOT EXISTS "Ticket_status_priority_createdAt_idx"
  ON "Ticket"("status", "priority", "createdAt");

CREATE INDEX IF NOT EXISTS "Ticket_createdAt_idx"
  ON "Ticket"("createdAt");

CREATE INDEX IF NOT EXISTS "Ticket_requesterId_createdAt_idx"
  ON "Ticket"("requesterId", "createdAt");

CREATE INDEX IF NOT EXISTS "Ticket_assigneeId_createdAt_idx"
  ON "Ticket"("assigneeId", "createdAt");

CREATE INDEX IF NOT EXISTS "Ticket_title_idx"
  ON "Ticket"("title");

-- Trigram indexes to accelerate contains/ILIKE queries.
CREATE INDEX IF NOT EXISTS "Ticket_code_trgm_idx"
  ON "Ticket" USING GIN ("code" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Ticket_title_trgm_idx"
  ON "Ticket" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Ticket_description_trgm_idx"
  ON "Ticket" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "User_fullName_trgm_idx"
  ON "User" USING GIN ("fullName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "User_email_trgm_idx"
  ON "User" USING GIN ("email" gin_trgm_ops);

-- Full-text indexes for large-scale search mode.
CREATE INDEX IF NOT EXISTS "Ticket_search_vector_idx"
  ON "Ticket" USING GIN (
    to_tsvector(
      'simple',
      coalesce("code", '') || ' ' || coalesce("title", '') || ' ' || coalesce("description", '')
    )
  );

CREATE INDEX IF NOT EXISTS "User_search_vector_idx"
  ON "User" USING GIN (
    to_tsvector('simple', coalesce("fullName", '') || ' ' || coalesce("email", ''))
  );
