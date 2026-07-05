"use client";

import { Puzzle as PuzzleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DIFFICULTY_LABELS, THEME_LABELS } from "@/lib/labels";
import type { PuzzleClientView } from "@/types/game";

const DIFF_COLOR: Record<string, string> = {
  EASY: "border-emerald-500 text-emerald-600 dark:text-emerald-400",
  MEDIUM: "border-amber-500 text-amber-600 dark:text-amber-400",
  HARD: "border-rose-500 text-rose-600 dark:text-rose-400",
};

/** Заголовок задачи: номер, прогресс-точки, тема, сложность, чей ход */
export function PuzzleInfo({ puzzle }: { puzzle: PuzzleClientView }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PuzzleIcon className="size-4" />
          Задача {puzzle.index + 1} из {puzzle.total}
          {/* Визуальный прогресс по задачам */}
          <span className="ml-1 flex items-center gap-1">
            {Array.from({ length: puzzle.total }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  i < puzzle.index && "bg-primary/40",
                  i === puzzle.index && "size-2 bg-primary",
                  i > puzzle.index && "bg-muted-foreground/25"
                )}
              />
            ))}
          </span>
        </div>
        <h2 className="font-heading text-xl font-bold">{puzzle.title}</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{THEME_LABELS[puzzle.theme]}</Badge>
        <Badge variant="outline" className={DIFF_COLOR[puzzle.difficulty]}>
          {DIFFICULTY_LABELS[puzzle.difficulty]}
        </Badge>
        <Badge className="bg-foreground text-background">
          Ход {puzzle.sideToMove === "w" ? "белых" : "чёрных"}
        </Badge>
      </div>
    </div>
  );
}
