-- Add lichessId column for imported puzzles (dedup on re-import)
ALTER TABLE "puzzles" ADD COLUMN "lichessId" TEXT;

CREATE UNIQUE INDEX "puzzles_lichessId_key" ON "puzzles"("lichessId");
