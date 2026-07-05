"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Play, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MODE_HINTS, MODE_LABELS } from "@/lib/labels";
import type { RoomSnapshot } from "@/types/game";

interface Props {
  snapshot: RoomSnapshot;
  isHost: boolean;
  onStart: () => Promise<string | null>;
}

/** Экран ожидания: код комнаты, список игроков, кнопка старта (у учителя) */
export function LobbyView({ snapshot, isHost, onStart }: Props) {
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  const students = snapshot.players.filter((p) => p.role === "STUDENT");

  function copyCode() {
    navigator.clipboard.writeText(snapshot.code);
    setCopied(true);
    toast.success("Код скопирован");
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleStart() {
    setStarting(true);
    const error = await onStart();
    setStarting(false);
    if (error) toast.error(error);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="border-primary/30 bg-gradient-to-b from-primary/5 to-transparent">
        <CardHeader className="text-center">
          <CardDescription>Код для входа</CardDescription>
          <button
            onClick={copyCode}
            className="group mx-auto flex items-center gap-3"
            title="Скопировать код"
          >
            <span className="font-heading text-5xl font-black tracking-[0.3em] text-primary">
              {snapshot.code}
            </span>
            {copied ? (
              <Check className="size-6 text-emerald-500" />
            ) : (
              <Copy className="size-6 text-muted-foreground transition-colors group-hover:text-foreground" />
            )}
          </button>
          <CardDescription className="mt-2">
            Ученики вводят его в своём кабинете
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-center gap-2">
          <Badge variant="secondary">{MODE_LABELS[snapshot.mode]}</Badge>
          <Badge variant="outline">{snapshot.puzzleCount} задач</Badge>
          <Badge variant="outline">{snapshot.secondsPerPuzzle} сек/задача</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <Users className="size-5 text-primary" />
            Игроки ({students.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              Ждём подключения учеников…
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {students.map((p) => (
                <div
                  key={p.userId}
                  className="flex flex-col items-center gap-2 rounded-lg border p-3"
                >
                  <Avatar>
                    <AvatarFallback>
                      {p.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm font-medium">{p.name}</span>
                  {p.team && (
                    <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                      Команда {p.team}
                    </Badge>
                  )}
                  <span
                    className={
                      p.connected
                        ? "text-[10px] text-emerald-500"
                        : "text-[10px] text-muted-foreground"
                    }
                  >
                    {p.connected ? "в сети" : "не в сети"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isHost ? (
        <div className="space-y-2">
          <p className="text-center text-sm text-muted-foreground">
            {MODE_HINTS[snapshot.mode]}
          </p>
          <Button
            size="lg"
            className="w-full"
            onClick={handleStart}
            disabled={starting || students.length === 0}
          >
            {starting ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Play className="size-5" />
            )}
            Начать игру
          </Button>
        </div>
      ) : (
        <p className="text-center text-muted-foreground">
          Ожидаем, пока преподаватель начнёт игру…
        </p>
      )}
    </div>
  );
}
