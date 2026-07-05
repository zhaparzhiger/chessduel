"use client";

/**
 * LocalZone — независимая игровая зона локального занятия.
 *
 * Несколько таких зон живут на одном экране (одно устройство, несколько
 * учеников). Каждая зона держит собственную доску и проверяет ходы
 * локально через chess.js по заранее загруженному решению.
 */
import { useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTheme } from "next-themes";
import { Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface LocalPuzzle {
  id: string;
  title: string;
  description: string;
  fen: string;
  /** Решение в SAN; чётные индексы — ходы ученика */
  moves: string[];
}

interface Props {
  playerName: string;
  points: number;
  puzzle: LocalPuzzle;
  /** Раунд активен (таймер идёт) */
  active: boolean;
  attemptsPerPuzzle: number;
  /** Зона сообщает наверх: решено (сколько попыток истрачено) или провалено */
  onSolved: (retriesUsed: number) => void;
  onFailed: () => void;
}

type ZoneStatus = "playing" | "solved" | "failed";

export function LocalZone({
  playerName,
  points,
  puzzle,
  active,
  attemptsPerPuzzle,
  onSolved,
  onFailed,
}: Props) {
  const { resolvedTheme } = useTheme();
  const [game, setGame] = useState(() => new Chess(puzzle.fen));
  const [position, setPosition] = useState(puzzle.fen);
  const [step, setStep] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(attemptsPerPuzzle);
  const [status, setStatus] = useState<ZoneStatus>("playing");
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);

  const sideToMove = puzzle.fen.split(" ")[1] === "b" ? "b" : "w";

  // Сброс зоны при новой задаче
  useEffect(() => {
    setGame(new Chess(puzzle.fen));
    setPosition(puzzle.fen);
    setStep(0);
    setAttemptsLeft(attemptsPerPuzzle);
    setStatus("playing");
    setFlash(null);
    setSelected(null);
  }, [puzzle.id, puzzle.fen, attemptsPerPuzzle]);

  const locked = !active || status !== "playing";

  /** Локальная проверка хода против решения */
  function tryMove(from: string, to: string, promotion?: string) {
    if (locked) return false;
    const probe = new Chess(game.fen());
    let mv;
    try {
      mv = probe.move({ from, to, promotion: promotion ?? "q" });
    } catch {
      blink("wrong");
      return false;
    }

    const expected = puzzle.moves[step];
    const isExpected = mv.san === expected;
    const isAltMate =
      !isExpected && expected?.endsWith("#") && probe.isCheckmate();

    if (!isExpected && !isAltMate) {
      // Неверно: попытка сгорает, доска возвращается к началу
      const left = attemptsLeft - 1;
      setAttemptsLeft(left);
      setGame(new Chess(puzzle.fen));
      setPosition(puzzle.fen);
      setStep(0);
      blink("wrong");
      if (left <= 0) {
        setStatus("failed");
        onFailed();
      }
      return false;
    }

    // Верно: применяем автоответ соперника, если есть
    const reply = puzzle.moves[step + 1];
    if (reply !== undefined) probe.move(reply);
    setGame(new Chess(probe.fen()));
    setPosition(probe.fen());
    const nextStep = step + 2;
    setStep(nextStep);
    blink("correct");

    if (nextStep >= puzzle.moves.length) {
      setStatus("solved");
      onSolved(attemptsPerPuzzle - attemptsLeft);
    }
    return true;
  }

  function blink(kind: "correct" | "wrong") {
    setFlash(kind);
    setTimeout(() => setFlash(null), kind === "correct" ? 600 : 400);
  }

  /** Клик по клетке: выбрать фигуру → выбрать цель (удобно на планшете) */
  function onSquareClick(square: string) {
    if (locked) return;
    const sq = square as Square;
    if (selected) {
      if (sq === selected) return setSelected(null);
      const probe = new Chess(game.fen());
      try {
        const mv = probe.move({ from: selected, to: sq, promotion: "q" });
        if (mv) {
          setSelected(null);
          tryMove(selected, sq, mv.promotion);
          return;
        }
      } catch {
        // не ход — переселект ниже
      }
    }
    const piece = game.get(sq);
    setSelected(piece && piece.color === sideToMove ? sq : null);
  }

  const squareStyles = useMemo(() => {
    if (!selected) return {};
    const styles: Record<string, React.CSSProperties> = {
      [selected]: { background: "rgba(59,130,246,0.35)" },
    };
    for (const m of game.moves({ square: selected, verbose: true })) {
      styles[m.to] = {
        background:
          "radial-gradient(circle, rgba(59,130,246,0.5) 22%, transparent 24%)",
      };
    }
    return styles;
  }, [selected, game]);

  return (
    <Card
      className={cn(
        "transition-shadow",
        status === "solved" && "ring-2 ring-emerald-500",
        status === "failed" && "ring-2 ring-destructive/60"
      )}
    >
      <CardContent className="space-y-2 pt-4">
        {/* Шапка зоны: имя, очки, попытки */}
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-heading font-semibold">{playerName}</span>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: attemptsPerPuzzle }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-2 rounded-full",
                  i < attemptsLeft ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            ))}
            <Badge variant="secondary" className="ml-1 font-mono">
              {points}
            </Badge>
          </div>
        </div>

        <div
          className={cn(
            "relative overflow-hidden rounded-lg border-4 transition-colors duration-300",
            flash === "correct" && "border-emerald-500",
            flash === "wrong" && "border-destructive",
            !flash && "border-transparent"
          )}
        >
          <Chessboard
            id={`zone-${playerName}`}
            position={position}
            onPieceDrop={(from, to) => tryMove(from, to)}
            onSquareClick={onSquareClick}
            boardOrientation={sideToMove === "w" ? "white" : "black"}
            arePiecesDraggable={!locked}
            customSquareStyles={squareStyles}
            customBoardStyle={{ borderRadius: "0.4rem" }}
            customDarkSquareStyle={{
              backgroundColor: resolvedTheme === "dark" ? "#4b5563" : "#b58863",
            }}
            customLightSquareStyle={{
              backgroundColor: resolvedTheme === "dark" ? "#9ca3af" : "#f0d9b5",
            }}
          />

          {status === "solved" && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/10 backdrop-blur-[1px]">
              <div className="animate-in zoom-in flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-1.5 font-heading font-bold text-white shadow-lg">
                <Check className="size-4" strokeWidth={3} />
                Решено!
              </div>
            </div>
          )}
          {status === "failed" && (
            <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 backdrop-blur-[1px]">
              <div className="flex items-center gap-1.5 rounded-full bg-destructive px-4 py-1.5 font-heading font-bold text-white shadow-lg">
                <X className="size-4" strokeWidth={3} />
                Попытки кончились
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
