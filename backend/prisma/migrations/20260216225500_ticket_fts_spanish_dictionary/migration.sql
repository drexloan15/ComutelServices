-- Rebuild full-text indexes with Spanish stemming dictionary.
DROP INDEX IF EXISTS "Ticket_search_vector_idx";
DROP INDEX IF EXISTS "User_search_vector_idx";

CREATE INDEX IF NOT EXISTS "Ticket_search_vector_idx"
  ON "Ticket" USING GIN (
    to_tsvector(
      'spanish',
      coalesce("code", '') || ' ' || coalesce("title", '') || ' ' || coalesce("description", '')
    )
  );

CREATE INDEX IF NOT EXISTS "User_search_vector_idx"
  ON "User" USING GIN (
    to_tsvector('spanish', coalesce("fullName", '') || ' ' || coalesce("email", ''))
  );
