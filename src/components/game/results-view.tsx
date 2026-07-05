"use client";

import { useRouter } from "next/navigation";
import { Check, Crown, Home, Medal, Minus, RotateCcw, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GameMode, GameOverPayload, PuzzleOutcome } from "@/types/game";

interface Props {
  result: GameOverPayload;
  mode: GameMode;
  meId: string;
  isHost: boolean;
}

const MEDAL_COLOR = ["text-yellow-500", "text-slate-400", "text-amber-700"];

/** Значок результата одной задачи в истории игрока */
function OutcomeDot({ outcome, title }: { outcome: PuzzleOutcome; title: string }) {
  const styles: Record<PuzzleOutcome, string> = {
    solved: "bg-green-500/15 text-green-600 dark:text-green-400",
    failed: "bg-red-500/15 text-red-600 dark:text-red-400",
    missed: "bg-muted text-muted-foreground",
  };
  const Icon =
    outcome === "solved" ? Check : outcome === "failed" ? X : Minus;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-full",
        styles[outcome]
      )}
    >
      <Icon className="size-3" strokeWidth={3} />
    </span>
  );
}

/** Финальный экран: подиум, личный итог, таблица с историей задач, действия */
export function ResultsView({ result, mode, meId, isHost }: Props) {
  const router = useRouter();
  const { leaderboard, winningTeam, history, puzzleTitles } = result;
  const top = leaderboard.slice(0, 3);

  // Личная сводка текущего ученика (если он играл)
  const myIndex = leaderboard.findIndex((e) => e.userId === meId);
  const me = myIndex >= 0 ? leaderboard[myIndex] : null;
  const myHistory = me ? history[me.userId] ?? [] : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div className="text-center">
        <Trophy className="mx-auto mb-2 size-12 text-yellow-500" />
        <h1 className="font-heading text-3xl font-bold">Игра завершена!</h1>
        {mode === "TEAM" && winningTeam && (
          <p className="mt-2 text-lg">
            {winningTeam === "DRAW" ? (
              "Ничья между командами!"
            ) : (
              <>
                Победила{" "}
                <span className="font-bold text-primary">
                  команда {winningTeam}
                </span>
              </>
            )}
          </p>
        )}
      </div>

      {/* Подиум */}
      {top.length > 0 && (
        <div className="flex items-end justify-center gap-3">
          {top.map((e, i) => {
            const heights = ["h-28", "h-20", "h-16"];
            // Порядок на подиуме: 2-1-3
            const order = [1, 0, 2][i];
            const podium = top[order];
            if (!podium) return null;
            return (
              <div key={podium.userId} className="flex flex-col items-center gap-2">
                <Crown
                  className={cn("size-6", MEDAL_COLOR[order] ?? "text-transparent")}
                />
                <span className="max-w-20 truncate text-sm font-medium">
                  {podium.name}
                </span>
                <div
                  className={cn(
                    "flex w-20 flex-col items-center justify-start rounded-t-lg bg-gradient-to-b pt-2",
                    heights[order],
                    order === 0 && "from-yellow-500/30",
                    order === 1 && "from-slate-400/30",
                    order === 2 && "from-amber-700/30"
                  )}
                >
                  <span className="font-heading text-xl font-bold">
                    {podium.points}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    #{order + 1}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Личный итог ученика */}
      {me && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-around gap-4 py-4 text-center">
            <div>
              <div className="font-heading text-2xl font-bold text-primary">
                #{myIndex + 1}
              </div>
              <div className="text-xs text-muted-foreground">ваше место</div>
            </div>
            <div>
              <div className="font-heading text-2xl font-bold">{me.points}</div>
              <div className="text-xs text-muted-foreground">очков</div>
            </div>
            <div>
              <div className="font-heading text-2xl font-bold">
                {me.solved} / {puzzleTitles.length}
              </div>
              <div className="text-xs text-muted-foreground">задач решено</div>
            </div>
            <div className="flex items-center gap-1">
              {myHistory.map((o, i) => (
                <OutcomeDot key={i} outcome={o} title={puzzleTitles[i] ?? ""} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Полная таблица с историей по задачам */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <Medal className="size-5 text-primary" />
            Итоговая таблица
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {leaderboard.map((e, i) => (
            <div
              key={e.userId}
              className={cn(
                "rounded-lg px-3 py-2",
                e.userId === meId && "bg-primary/10 ring-1 ring-primary/30"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="w-5 text-center font-heading font-bold">
                  {i + 1}
                </span>
                <span className="flex-1 truncate font-medium">
                  {e.name}
                  {e.userId === meId && (
                    <span className="ml-1 text-xs text-muted-foreground">(вы)</span>
                  )}
                </span>
                {mode === "TEAM" && e.team && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    {e.team}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {e.solved} решено
                </span>
                <span className="w-14 text-right font-heading font-bold text-primary">
                  {e.points}
                </span>
              </div>
              {/* История: результат каждой задачи (наведите — название) */}
              {(history[e.userId]?.length ?? 0) > 0 && (
                <div className="mt-1.5 flex items-center gap-1 pl-8">
                  {history[e.userId].map((o, idx) => (
                    <OutcomeDot
                      key={idx}
                      outcome={o}
                      title={`${idx + 1}. ${puzzleTitles[idx] ?? ""}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Легенда */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <OutcomeDot outcome="solved" title="" /> решена
        </span>
        <span className="flex items-center gap-1.5">
          <OutcomeDot outcome="failed" title="" /> ошибка
        </span>
        <span className="flex items-center gap-1.5">
          <OutcomeDot outcome="missed" title="" /> не успел
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => router.push("/dashboard")}
        >
          <Home className="size-4" />
          В кабинет
        </Button>
        {isHost && (
          <Button className="flex-1" onClick={() => router.refresh()}>
            <RotateCcw className="size-4" />
            Новая игра
          </Button>
        )}
      </div>
    </div>
  );
}
