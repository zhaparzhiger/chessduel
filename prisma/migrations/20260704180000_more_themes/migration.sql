-- Extend PuzzleTheme with 6 more tactical themes
ALTER TYPE "PuzzleTheme" ADD VALUE 'MATE_IN_3';
ALTER TYPE "PuzzleTheme" ADD VALUE 'BACK_RANK';
ALTER TYPE "PuzzleTheme" ADD VALUE 'SKEWER';
ALTER TYPE "PuzzleTheme" ADD VALUE 'SACRIFICE';
ALTER TYPE "PuzzleTheme" ADD VALUE 'PROMOTION';
ALTER TYPE "PuzzleTheme" ADD VALUE 'HANGING_PIECE';
