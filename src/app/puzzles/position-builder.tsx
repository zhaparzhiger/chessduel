"use client";

/**
 * PositionBuilder — визуальный конструктор задач.
 *
 * Шаг 1 «Расстановка»: учитель выбирает фигуру в палитре и кликами
 * расставляет её на доске (перетаскивание тоже работает). FEN строится сам.
 *
 * Шаг 2 «Запись решения»: доска становится игровой — учитель разыгрывает
 * решение ходами (ход ученика, ответ соперника, …), нотация записывается
 * автоматически. Результат передаётся в форму сохранения задачи.
 */
import { useMemo, useRef, useState } from "react";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTheme } from "next-themes";
import { Check, Eraser, RotateCcw, Trash2, Undo2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Props {
  /** Готовые FEN + решение передаются в форму сохранения */
  onApply: (fen: string, solution: string) => void;
}

type Tool =
  | { kind: "place"; color: Color; piece: PieceSymbol }
  | { kind: "erase" }
  | null;

/** Палитра фигур: глифы Unicode */
const PALETTE: { color: Color; piece: PieceSymbol; glyph: string }[] = [
  { color: "w", piece: "k", glyph: "♔" },
  { color: "w", piece: "q", glyph: "♕" },
  { color: "w", piece: "r", glyph: "♖" },
  { color: "w", piece: "b", glyph: "♗" },
  { color: "w", piece: "n", glyph: "♘" },
  { color: "w", piece: "p", glyph: "♙" },
  { color: "b", piece: "k", glyph: "♚" },
  { color: "b", piece: "q", glyph: "♛" },
  { color: "b", piece: "r", glyph: "♜" },
  { color: "b", piece: "b", glyph: "♝" },
  { color: "b", piece: "n", glyph: "♞" },
  { color: "b", piece: "p", glyph: "♟" },
];

export function PositionBuilder({ onApply }: Props) {
  const { resolvedTheme } = useTheme();

  // Редактор позиции: chess.js как «хранилище фигур»
  const editorRef = useRef<Chess | null>(null);
  if (!editorRef.current) {
    editorRef.current = new Chess();
    editorRef.current.clear();
  }
  const editor = editorRef.current;

  const [boardFen, setBoardFen] = useState(() => editor.fen().split(" ")[0]);
  const [turn, setTurn] = useState<"w" | "b">("w");
  const [tool, setTool] = useState<Tool>(null);

  // Запись решения
  const [recording, setRecording] = useState(false);
  const recRef = useRef<Chess | null>(null);
  const [recPosition, setRecPosition] = useState("");
  const [sans, setSans] = useState<string[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);

  const fullFen = `${boardFen} ${turn} - - 0 1`;

  function refresh() {
    setBoardFen(editor.fen().split(" ")[0]);
  }

  // ─────────── Шаг 1: расстановка ───────────

  function onBuildSquareClick(square: string) {
    const sq = square as Square;
    if (!tool) return;
    if (tool.kind === "erase") {
      editor.remove(sq);
    } else {
      editor.remove(sq);
      const ok = editor.put({ type: tool.piece, color: tool.color }, sq);
      if (!ok) toast.error("Нельзя поставить второго короля");
    }
    refresh();
  }

  function onBuildDrop(from: string, to: string): boolean {
    const piece = editor.remove(from as Square);
    if (!piece) return false;
    editor.remove(to as Square);
    editor.put({ type: piece.type, color: piece.color }, to as Square);
    refresh();
    return true;
  }

  function clearBoard() {
    editor.clear();
    refresh();
  }

  function startPosition() {
    editor.reset();
    refresh();
  }

  // ─────────── Шаг 2: запись решения ───────────

  function startRecording() {
    const placement = boardFen;
    if (!/K/.test(placement) || !/k/.test(placement)) {
      toast.error("На доске должны быть оба короля");
      return;
    }
    try {
      recRef.current = new Chess(fullFen);
    } catch {
      toast.error(
        "Позиция нелегальна — проверьте расстановку (например, король не под шахом при чужом ходе)"
      );
      return;
    }
    setSans([]);
    setRecPosition(recRef.current.fen());
    setSelected(null);
    setRecording(true);
  }

  function tryRecordMove(from: string, to: string): boolean {
    const rec = recRef.current;
    if (!rec) return false;
    try {
      const mv = rec.move({ from, to, promotion: "q" });
      setSans((prev) => [...prev, mv.san]);
      setRecPosition(rec.fen());
      setSelected(null);
      return true;
    } catch {
      return false;
    }
  }

  function onRecSquareClick(square: string) {
    const rec = recRef.current;
    if (!rec) return;
    const sq = square as Square;
    if (selected) {
      if (sq === selected) return setSelected(null);
      if (tryRecordMove(selected, sq)) return;
    }
    const piece = rec.get(sq);
    setSelected(piece && piece.color === rec.turn() ? sq : null);
  }

  function undoMove() {
    const rec = recRef.current;
    if (!rec || sans.length === 0) return;
    rec.undo();
    setSans((prev) => prev.slice(0, -1));
    setRecPosition(rec.fen());
  }

  function finishRecording() {
    if (sans.length % 2 === 0) {
      toast.error(
        "Решение должно заканчиваться ходом ученика: ход ученика, ответ соперника, ход ученика…"
      );
      return;
    }
    onApply(fullFen, sans.join(" "));
    toast.success("Позиция и решение перенесены в форму — осталось сохранить!");
  }

  const recSquareStyles = useMemo(() => {
    const rec = recRef.current;
    if (!selected || !rec) return {};
    const styles: Record<string, React.CSSProperties> = {
      [selected]: { background: "rgba(59,130,246,0.35)" },
    };
    for (const m of rec.moves({ square: selected, verbose: true })) {
      styles[m.to] = {
        background:
          "radial-gradient(circle, rgba(59,130,246,0.5) 22%, transparent 24%)",
      };
    }
    return styles;
  }, [selected, recPosition]); // eslint-disable-line react-hooks/exhaustive-deps

  const boardColors = {
    customDarkSquareStyle: {
      backgroundColor: resolvedTheme === "dark" ? "#4b5563" : "#b58863",
    },
    customLightSquareStyle: {
      backgroundColor: resolvedTheme === "dark" ? "#9ca3af" : "#f0d9b5",
    },
    customBoardStyle: { borderRadius: "0.5rem" },
  };

  // ═══════════ Рендер ═══════════

  if (recording) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border bg-primary/5 p-3 text-sm">
          <span className="font-semibold">Запись решения:</span> сделайте на
          доске ход ученика, затем ответ соперника и так далее. Первый ход —
          всегда ход ученика ({turn === "w" ? "белые" : "чёрные"}).
        </div>

        <Chessboard
          id="builder-record"
          position={recPosition}
          onPieceDrop={tryRecordMove}
          onSquareClick={onRecSquareClick}
          boardOrientation={turn === "w" ? "white" : "black"}
          customSquareStyles={recSquareStyles}
          {...boardColors}
        />

        {/* Записанные ходы */}
        <div className="flex min-h-8 flex-wrap items-center gap-1.5">
          {sans.length === 0 && (
            <span className="text-xs text-muted-foreground">
              Ходы появятся здесь…
            </span>
          )}
          {sans.map((s, i) => (
            <Badge
              key={i}
              variant={i % 2 === 0 ? "default" : "outline"}
              className="font-mono"
            >
              {s}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={undoMove} disabled={sans.length === 0}>
            <Undo2 className="size-4" />
            Отменить ход
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setRecording(false)}>
            <RotateCcw className="size-4" />
            К расстановке
          </Button>
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            onClick={finishRecording}
            disabled={sans.length === 0}
          >
            <Check className="size-4" />
            Готово
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-primary/5 p-3 text-sm">
        <span className="font-semibold">Расстановка:</span> выберите фигуру и
        кликайте по доске. Фигуры можно перетаскивать, ластик — удаляет.
      </div>

      {/* Палитра */}
      <div className="flex flex-wrap items-center gap-1">
        {PALETTE.map((p) => {
          const isActive =
            tool?.kind === "place" && tool.color === p.color && tool.piece === p.piece;
          return (
            <button
              key={p.color + p.piece}
              type="button"
              onClick={() => setTool(isActive ? null : { kind: "place", color: p.color, piece: p.piece })}
              className={cn(
                "flex size-9 items-center justify-center rounded-md border text-2xl leading-none transition-colors",
                p.color === "b" && "bg-muted/60",
                isActive
                  ? "border-primary bg-primary/15 ring-2 ring-primary/40"
                  : "hover:bg-accent"
              )}
              aria-label={`${p.color === "w" ? "Белый" : "Чёрный"} ${p.piece}`}
            >
              {p.glyph}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setTool(tool?.kind === "erase" ? null : { kind: "erase" })}
          className={cn(
            "flex size-9 items-center justify-center rounded-md border transition-colors",
            tool?.kind === "erase"
              ? "border-destructive bg-destructive/15 ring-2 ring-destructive/40"
              : "hover:bg-accent"
          )}
          aria-label="Ластик"
        >
          <Eraser className="size-4" />
        </button>
      </div>

      <Chessboard
        id="builder-setup"
        position={boardFen}
        onPieceDrop={onBuildDrop}
        onSquareClick={onBuildSquareClick}
        arePiecesDraggable
        {...boardColors}
      />

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label>Чей ход</Label>
          <Select value={turn} onValueChange={(v) => setTurn(v as "w" | "b")}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="w">Ход белых</SelectItem>
              <SelectItem value="b">Ход чёрных</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={startPosition}>
          <RotateCcw className="size-4" />
          Начальная
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clearBoard}>
          <Trash2 className="size-4" />
          Очистить
        </Button>
        <Button type="button" size="sm" className="ml-auto" onClick={startRecording}>
          <Wand2 className="size-4" />
          Записать решение →
        </Button>
      </div>

      <p className="font-mono text-xs text-muted-foreground">FEN: {fullFen}</p>
    </div>
  );
}
