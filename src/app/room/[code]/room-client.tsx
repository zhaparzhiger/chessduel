"use client";

/**
 * RoomClient — сборка всей игровой комнаты на клиенте.
 * По статусу комнаты показывает: лобби → игру → результаты.
 */
import { useCallback } from "react";
import Link from "next/link";
import { AlertCircle, Crown, Loader2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useGameRoom } from "@/hooks/use-game-room";
import { PuzzleBoard } from "@/components/game/puzzle-board";
import { PuzzleInfo } from "@/components/game/puzzle-info";
import { GameTimer } from "@/components/game/game-timer";
import { Leaderboard } from "@/components/game/leaderboard";
import { RoomChat } from "@/components/game/room-chat";
import { LobbyView } from "@/components/game/lobby-view";
import { PuzzleSummaryCard } from "@/components/game/puzzle-summary";
import { ResultsView } from "@/components/game/results-view";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MoveResult } from "@/types/game";

interface Me {
  id: string;
  name: string;
  role: "TEACHER" | "STUDENT";
}

export function RoomClient({ code, me }: { code: string; me: Me }) {
  const {
    connected,
    joinState,
    joinError,
    snapshot,
    puzzle,
    deadline,
    leaderboard,
    summary,
    gameOver,
    messages,
    startGame,
    sendMove,
    sendChat,
  } = useGameRoom(code);

  const isHost = snapshot?.hostId === me.id;
  const isStudent = me.role === "STUDENT";
  // Выбыл ли текущий ученик (режим «королевская битва»)
  const eliminated =
    isStudent && (leaderboard.find((e) => e.userId === me.id)?.eliminated ?? false);

  // Реакция на результат хода: тосты + звук успеха
  const handleResult = useCallback((result: MoveResult | { error: string }) => {
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    if (result.solved) {
      toast.success(`Задача решена! +${result.points} очков`);
    } else if (result.correct) {
      toast.success("Верный ход! Продолжайте…");
    } else {
      toast.error("Неверный ход, попробуйте ещё раз");
    }
  }, []);

  // ─────────── Состояния подключения ───────────
  if (joinState === "error") {
    return (
      <CenteredMessage
        icon={<AlertCircle className="size-10 text-destructive" />}
        title="Не удалось войти"
        text={joinError ?? "Комната недоступна"}
      >
        <Button asChild>
          <Link href="/dashboard">Вернуться в кабинет</Link>
        </Button>
      </CenteredMessage>
    );
  }

  if (!connected || joinState === "connecting" || !snapshot) {
    return (
      <CenteredMessage
        icon={
          connected ? (
            <Loader2 className="size-10 animate-spin text-primary" />
          ) : (
            <WifiOff className="size-10 text-muted-foreground" />
          )
        }
        title={connected ? "Подключаемся к комнате…" : "Соединение…"}
        text={code}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-muted/30">
      {/* Мини-шапка комнаты */}
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-heading font-bold">
            <Crown className="size-5 text-primary" />
            {snapshot.name}
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm tracking-widest text-muted-foreground">
              {snapshot.code}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* ─────────── Результаты ─────────── */}
        {gameOver ? (
          <ResultsView
            result={gameOver}
            mode={snapshot.mode}
            meId={me.id}
            isHost={isHost}
          />
        ) : snapshot.status === "LOBBY" ? (
          /* ─────────── Лобби ─────────── */
          <LobbyView snapshot={snapshot} isHost={isHost} onStart={startGame} />
        ) : (
          /* ─────────── Игра ─────────── */
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-4">
              {puzzle && (
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <PuzzleInfo puzzle={puzzle} />
                    {deadline && (
                      <GameTimer
                        deadline={deadline}
                        totalSeconds={snapshot.secondsPerPuzzle}
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Выбывший ученик — заметный баннер */}
              {eliminated && !summary && (
                <Card className="border-red-500/40 bg-red-500/10">
                  <CardContent className="flex items-center gap-3 py-4">
                    <AlertCircle className="size-6 shrink-0 text-red-500" />
                    <div>
                      <p className="font-heading font-semibold">Вы выбыли из битвы</p>
                      <p className="text-sm text-muted-foreground">
                        Наблюдайте за оставшимися игроками — итоговая статистика
                        будет в конце игры.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Между задачами — разбор; иначе доска */}
              {summary ? (
                <PuzzleSummaryCard summary={summary} leaderboard={leaderboard} />
              ) : puzzle && isStudent && !eliminated ? (
                <Card>
                  <CardContent className="pt-6">
                    <PuzzleBoard
                      fen={puzzle.fen}
                      puzzleId={puzzle.id}
                      sideToMove={puzzle.sideToMove}
                      disabled={false}
                      onMove={sendMove}
                      onResult={handleResult}
                    />
                  </CardContent>
                </Card>
              ) : puzzle ? (
                /* Учитель наблюдает: доска без интерактива */
                <Card>
                  <CardContent className="pt-6">
                    <PuzzleBoard
                      fen={puzzle.fen}
                      puzzleId={puzzle.id}
                      sideToMove={puzzle.sideToMove}
                      disabled
                      onMove={sendMove}
                    />
                    <p className="mt-3 text-center text-sm text-muted-foreground">
                      Режим наблюдателя — вы видите, как ученики решают задачу.
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </div>

            {/* Боковая панель: лидерборд + чат */}
            <aside className="space-y-4">
              <Leaderboard
                entries={leaderboard}
                mode={snapshot.mode}
                meId={me.id}
              />
              <RoomChat messages={messages} onSend={sendChat} meId={me.id} />
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

/** Полноэкранное центрированное сообщение (загрузка/ошибка) */
function CenteredMessage({
  icon,
  title,
  text,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-muted/30 px-4 text-center">
      {icon}
      <div>
        <h1 className="font-heading text-xl font-bold">{title}</h1>
        {text && <p className="mt-1 font-mono text-muted-foreground">{text}</p>}
      </div>
      {children}
    </div>
  );
}
