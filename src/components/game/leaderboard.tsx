"use client";

import { Check, Crown, Skull, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GameMode, LeaderboardEntry } from "@/types/game";

interface Props {
  entries: LeaderboardEntry[];
  mode: GameMode;
  /** Подсветить текущего пользователя */
  meId?: string;
}

const MEDAL = ["text-yellow-500", "text-slate-400", "text-amber-700"];

/** Живой лидерборд: сортировка по очкам, индикация решения текущей задачи */
export function Leaderboard({ entries, mode, meId }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <Crown className="size-5 text-primary" />
          Лидерборд
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {entries.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Пока никого нет
          </p>
        )}
        {entries.map((e, i) => (
          <div
            key={e.userId}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
              e.userId === meId && "bg-primary/10 ring-1 ring-primary/30",
              e.eliminated && "opacity-40"
            )}
          >
            <span
              className={cn(
                "w-5 text-center font-heading text-sm font-bold",
                MEDAL[i] ?? "text-muted-foreground"
              )}
            >
              {i + 1}
            </span>

            {/* Индикатор состояния по текущей задаче */}
            <span className="flex size-5 items-center justify-center">
              {e.eliminated ? (
                <Skull className="size-4 text-muted-foreground" />
              ) : e.solvedCurrent ? (
                <Check className="size-4 text-emerald-500" />
              ) : e.failedCurrent ? (
                <X className="size-4 text-destructive" />
              ) : (
                <span className="size-2 rounded-full bg-muted-foreground/30" />
              )}
            </span>

            <span className="flex-1 truncate text-sm font-medium">
              {e.name}
              {e.userId === meId && (
                <span className="ml-1 text-xs text-muted-foreground">(вы)</span>
              )}
            </span>

            {mode === "TEAM" && e.team && (
              <Badge
                variant="outline"
                className={cn(
                  "h-5 px-1.5 text-[10px]",
                  e.team === "A"
                    ? "border-blue-500 text-blue-500"
                    : "border-rose-500 text-rose-500"
                )}
              >
                {e.team}
              </Badge>
            )}

            <span className="font-heading text-sm font-bold tabular-nums">
              {e.points}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
