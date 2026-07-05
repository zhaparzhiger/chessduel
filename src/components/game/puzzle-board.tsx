"use client";

/**
 * PuzzleBoard — интерактивная доска для решения задачи.
 *
 * Держит локальную позицию (chess.js) для мгновенного отклика и подсветки
 * легальных ходов, но истина всегда за сервером: каждый ход валидируется
 * через onMove, и позиция синхронизируется с ответом сервера.
 */
import { useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTheme } from "next-themes";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MoveResult } from "@/types/game";

interface Props {
  /** Стартовая позиция задачи (FEN) */
  fen: string;
  /** Ключ задачи — при смене сбрасываем доску */
  puzzleId: string;
  sideToMove: "w" | "b";
  disabled: boolean;
  /** Отправка хода на сервер; резолвится результатом проверки */
  onMove: (move: {
    from?: string;
    to?: string;
    promotion?: string;
    san?: string;
  }) => Promise<MoveResult | { error: string }>;
  /** Колбэк после ответа сервера (для тостов/звуков на уровне страницы) */
  onResult?: (result: MoveResult | { error: string }) => void;
}

export function PuzzleBoard({
  fen,
  puzzleId,
  sideToMove,
  disabled,
  onMove,
  onResult,
}: Props) {
  const { resolvedTheme } = useTheme();
  const [game, setGame] = useState(() => new Chess(fen));
  const [position, setPosition] = useState(fen);
  const [busy, setBusy] = useState(false);
  const [solved, setSolved] = useState(false);
  const [sanInput, setSanInput] = useState("");
  // Подсветка последнего хода и статуса (для анимации)
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);

  // Сброс при новой задаче
  useEffect(() => {
    const fresh = new Chess(fen);
    setGame(fresh);
    setPosition(fen);
    setSolved(false);
    setSanInput("");
    setFlash(null);
    setSelected(null);
  }, [fen, puzzleId]);

  const locked = disabled || busy || solved;

  /** Единая обработка хода (из drag&drop или из SAN-инпута) */
  async function applyMove(move: {
    from?: string;
    to?: string;
    promotion?: string;
    san?: string;
  }): Promise<boolean> {
    if (locked) return false;
    setBusy(true);
    setSelected(null);
    try {
      const result = await onMove(move);
      onResult?.(result);

      if ("error" in result) {
        setFlash("wrong");
        setTimeout(() => setFlash(null), 500);
        return false;
      }

      // Обновляем доску до позиции с сервера (учитывает автоответ соперника)
      setPosition(result.fen);
      setGame(new Chess(result.fen));

      if (result.correct) {
        setFlash("correct");
        setTimeout(() => setFlash(null), 700);
        if (result.solved) setSolved(true);
        return true;
      } else {
        // Неверный ход: сервер откатил позицию к началу задачи
        setFlash("wrong");
        setTimeout(() => setFlash(null), 500);
        return false;
      }
    } finally {
      setBusy(false);
    }
  }

  /** Drag & drop фигуры */
  function onPieceDrop(from: string, to: string): boolean {
    if (locked) return false;
    // Пробуем ход локально, чтобы определить легальность и превращение
    const probe = new Chess(game.fen());
    let mv;
    try {
      mv = probe.move({ from, to, promotion: "q" });
    } catch {
      setFlash("wrong");
      setTimeout(() => setFlash(null), 400);
      return false;
    }
    if (!mv) return false;

    const promotion = mv.promotion; // 'q' если было превращение
    void applyMove({ from, to, promotion });
    // Возвращаем true оптимистично — позиция всё равно перезапишется ответом
    return true;
  }

  /** Клик по клетке (удобно на планшете): выбрать фигуру → выбрать цель */
  function onSquareClick(square: string) {
    if (locked) return;
    const sq = square as Square;
    if (selected) {
      if (sq === selected) {
        setSelected(null);
        return;
      }
      // Пытаемся сходить выбранной фигурой на клетку
      const probe = new Chess(game.fen());
      try {
        const mv = probe.move({ from: selected, to: sq, promotion: "q" });
        if (mv) {
          void applyMove({ from: selected, to: sq, promotion: mv.promotion });
          return;
        }
      } catch {
        // не легальный ход — просто переселектим
      }
    }
    // Выбираем фигуру нужного цвета
    const piece = game.get(sq);
    if (piece && piece.color === sideToMove) setSelected(sq);
    else setSelected(null);
  }

  /** Ввод хода в нотации (например, «Qh5» или «e4») */
  function onSanSubmit(e: React.FormEvent) {
    e.preventDefault();
    const san = sanInput.trim();
    if (!san || locked) return;
    void applyMove({ san }).then((ok) => {
      if (ok) setSanInput("");
    });
  }

  // Подсветка выбранной фигуры и её легальных ходов
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
    <div className="space-y-3">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border-4 transition-colors duration-300",
          flash === "correct" && "border-emerald-500",
          flash === "wrong" && "border-destructive",
          !flash && "border-transparent"
        )}
      >
        <Chessboard
          position={position}
          onPieceDrop={onPieceDrop}
          onSquareClick={onSquareClick}
          boardOrientation={sideToMove === "w" ? "white" : "black"}
          arePiecesDraggable={!locked}
          customSquareStyles={squareStyles}
          customBoardStyle={{ borderRadius: "0.5rem" }}
          customDarkSquareStyle={{
            backgroundColor: resolvedTheme === "dark" ? "#4b5563" : "#b58863",
          }}
          customLightSquareStyle={{
            backgroundColor: resolvedTheme === "dark" ? "#9ca3af" : "#f0d9b5",
          }}
        />

        {/* Оверлей «решено» */}
        {solved && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/10 backdrop-blur-[1px]">
            <div className="animate-in zoom-in rounded-full bg-emerald-500 px-6 py-2 font-heading text-lg font-bold text-white shadow-lg">
              Решено! ✓
            </div>
          </div>
        )}
        {busy && (
          <div className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5">
            <Loader2 className="size-4 animate-spin" />
          </div>
        )}
      </div>

      {/* Ввод хода нотацией — альтернатива drag&drop */}
      <form onSubmit={onSanSubmit} className="flex gap-2">
        <Input
          value={sanInput}
          onChange={(e) => setSanInput(e.target.value)}
          placeholder="Ход нотацией, напр. Qh5 или e4"
          disabled={locked}
          className="font-mono"
        />
        <Button type="submit" disabled={locked || !sanInput.trim()}>
          Ходить
        </Button>
      </form>
      <p className="text-center text-xs text-muted-foreground">
        Перетащите фигуру, кликните по клеткам или введите ход нотацией.
        Ход {sideToMove === "w" ? "белых" : "чёрных"}.
      </p>
    </div>
  );
}
