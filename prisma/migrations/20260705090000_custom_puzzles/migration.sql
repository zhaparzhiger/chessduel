-- Custom teacher-uploaded puzzles + rooms restricted to them
ALTER TABLE "puzzles" ADD COLUMN "authorId" TEXT;

ALTER TABLE "puzzles" ADD CONSTRAINT "puzzles_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "puzzles_authorId_idx" ON "puzzles"("authorId");

ALTER TABLE "rooms" ADD COLUMN "customOnly" BOOLEAN NOT NULL DEFAULT false;
