"use client";

import { BookOpen, Skull, Trophy } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LeaderboardEntry, PuzzleSummary } from "@/types/game";

interface Props {
  summary: PuzzleSummary;
  leaderboard: LeaderboardEntry[];
}

/** Показывается в паузе между задачами: решение + объяснение + кто решил */
export function PuzzleSummaryCard({ summary, leaderboard }: Props) {
  const solvers = summary.solvedBy
    .map((id) => leaderboard.find((e) => e.userId === id)?.name)
    .filter(Boolean) as string[];

  const eliminatedName = summary.eliminated
    ? leaderboard.find((e) => e.userId === summary.eliminated)?.name
    : null;

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <BookOpen className="size-5 text-primary" />
          Разбор: {summary.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 text-sm font-medium text-muted-foreground">
            Решение
          </div>
          <code className="rounded-md bg-muted px-3 py-1.5 font-mono text-lg font-bold">
            {summary.solution}
          </code>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {summary.explanation}
        </p>

        <div className="flex items-center gap-2 text-sm">
          <Trophy className="size-4 text-yellow-500" />
          {solvers.length > 0 ? (
            <span>
              Решили: <span className="font-medium">{solvers.join(", ")}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Никто не решил вовремя</span>
          )}
        </div>

        {eliminatedName && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <Skull className="size-4" />
            Выбывает: <span className="font-medium">{eliminatedName}</span>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Следующая задача через несколько секунд…
        </p>
      </CardContent>
    </Card>
  );
}
