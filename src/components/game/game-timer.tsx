"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Props {
  /** Unix-время (мс) окончания */
  deadline: number;
  /** Полная длительность задачи (сек) — для прогресс-бара */
  totalSeconds: number;
}

/** Обратный отсчёт до дедлайна задачи с прогресс-баром */
export function GameTimer({ deadline, totalSeconds }: Props) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, deadline - Date.now())
  );

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [deadline]);

  const seconds = Math.ceil(remaining / 1000);
  const pct = Math.max(0, Math.min(100, (remaining / (totalSeconds * 1000)) * 100));
  const urgent = seconds <= 10;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Timer className="size-4" />
          Осталось времени
        </span>
        <span
          className={cn(
            "font-heading text-lg font-bold tabular-nums",
            urgent && "animate-pulse text-destructive"
          )}
        >
          {seconds} с
        </span>
      </div>
      <Progress
        value={pct}
        className={cn(urgent && "[&>div]:bg-destructive")}
      />
    </div>
  );
}
