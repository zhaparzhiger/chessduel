"use client";

/**
 * Управление учебными материалами учителя:
 *  - форма загрузки задачи (FEN + решение) с живым предпросмотром доски;
 *  - список загруженных задач с удалением.
 */
import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTheme } from "next-themes";
import { BookOpen, Loader2, Plus, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PositionBuilder } from "./position-builder";
import { DIFFICULTY_LABELS, THEME_LABELS } from "@/lib/labels";
import type { Difficulty, PuzzleTheme } from "@/types/game";

interface PuzzleRow {
  id: string;
  title: string;
  fen: string;
  solution: string;
  theme: string;
  difficulty: string;
}

const START_HINT = "Например: 6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1";

export function PuzzlesClient({ initialPuzzles }: { initialPuzzles: PuzzleRow[] }) {
  const { resolvedTheme } = useTheme();
  const [puzzles, setPuzzles] = useState(initialPuzzles);

  // Поля формы
  const [title, setTitle] = useState("");
  const [fen, setFen] = useState("");
  const [solution, setSolution] = useState("");
  const [theme, setTheme] = useState<PuzzleTheme>("MATE_IN_1");
  const [difficulty, setDifficulty] = useState<Difficulty>("EASY");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  // Способ ввода позиции: вручную (FEN) или конструктором на доске
  const [inputTab, setInputTab] = useState<"manual" | "builder">("builder");

  // Живой предпросмотр: FEN валиден → показываем позицию
  const previewFen = useMemo(() => {
    if (!fen.trim()) return null;
    try {
      new Chess(fen.trim());
      return fen.trim();
    } catch {
      return null;
    }
  }, [fen]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/puzzles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, fen, solution, theme, difficulty, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Не удалось сохранить задачу");
        return;
      }
      toast.success("Задача добавлена в ваши материалы!");
      setPuzzles((prev) => [
        {
          id: data.puzzle.id,
          title: data.puzzle.title,
          fen: data.puzzle.fen,
          solution: data.puzzle.solution,
          theme: data.puzzle.theme,
          difficulty: data.puzzle.difficulty,
        },
        ...prev,
      ]);
      setTitle("");
      setFen("");
      setSolution("");
      setDescription("");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    const res = await fetch(`/api/puzzles/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPuzzles((prev) => prev.filter((p) => p.id !== id));
      toast.success("Задача удалена");
    } else {
      toast.error("Не удалось удалить");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-heading text-3xl font-bold">
          <BookOpen className="size-7 text-primary" />
          Мои задачи
        </h1>
        <p className="text-muted-foreground">
          Загружайте учебные материалы перед занятием: эти задачи можно
          использовать в комнатах («только мои задачи») и в локальном занятии.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* ─────────── Форма загрузки ─────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Новая задача</CardTitle>
            <CardDescription>
              Вставьте FEN позиции и решение в шахматной нотации. Мы проверим,
              что все ходы легальны.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="p-title">Название</Label>
                <Input
                  id="p-title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Мат по 8-й горизонтали"
                />
              </div>

              {/* Два способа задать позицию и решение */}
              <Tabs value={inputTab} onValueChange={(v) => setInputTab(v as typeof inputTab)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="builder">🎨 Конструктор на доске</TabsTrigger>
                  <TabsTrigger value="manual">⌨️ Ввести FEN</TabsTrigger>
                </TabsList>

                <TabsContent value="builder" className="mt-3">
                  <PositionBuilder
                    onApply={(f, s) => {
                      setFen(f);
                      setSolution(s);
                      setInputTab("manual");
                    }}
                  />
                </TabsContent>

                <TabsContent value="manual" className="mt-3 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="p-fen">FEN позиции</Label>
                    <Input
                      id="p-fen"
                      required
                      value={fen}
                      onChange={(e) => setFen(e.target.value)}
                      placeholder={START_HINT}
                      className="font-mono text-sm"
                    />
                    {fen.trim() && !previewFen && (
                      <p className="text-xs text-destructive">
                        FEN пока некорректен — предпросмотр появится автоматически
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="p-solution">
                      Решение (SAN через пробел: ход ученика, ответ соперника, …)
                    </Label>
                    <Input
                      id="p-solution"
                      required
                      value={solution}
                      onChange={(e) => setSolution(e.target.value)}
                      placeholder="Например: Re8# или Qa1+ Kg8 Qa8#"
                      className="font-mono text-sm"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Тема</Label>
                  <Select value={theme} onValueChange={(v) => setTheme(v as PuzzleTheme)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(THEME_LABELS) as PuzzleTheme[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {THEME_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Сложность</Label>
                  <Select
                    value={difficulty}
                    onValueChange={(v) => setDifficulty(v as Difficulty)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                        <SelectItem key={d} value={d}>
                          {DIFFICULTY_LABELS[d]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-desc">Объяснение (показывается после решения)</Label>
                <Input
                  id="p-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Необязательно"
                />
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Добавить задачу
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ─────────── Предпросмотр ─────────── */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Предпросмотр</CardTitle>
          </CardHeader>
          <CardContent>
            {previewFen ? (
              <Chessboard
                position={previewFen}
                arePiecesDraggable={false}
                boardOrientation={previewFen.split(" ")[1] === "b" ? "black" : "white"}
                customBoardStyle={{ borderRadius: "0.5rem" }}
                customDarkSquareStyle={{
                  backgroundColor: resolvedTheme === "dark" ? "#4b5563" : "#b58863",
                }}
                customLightSquareStyle={{
                  backgroundColor: resolvedTheme === "dark" ? "#9ca3af" : "#f0d9b5",
                }}
              />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                Введите корректный FEN
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─────────── Список моих задач ─────────── */}
      <h2 className="mb-3 mt-10 font-heading text-xl font-bold">
        Загружено: {puzzles.length}
      </h2>
      {puzzles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            Пока нет своих задач — добавьте первую с помощью формы выше.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {puzzles.map((p) => (
            <Card key={p.id}>
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-heading font-semibold">{p.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Удалить"
                    onClick={() => onDelete(p.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">
                    {THEME_LABELS[p.theme as PuzzleTheme] ?? p.theme}
                  </Badge>
                  <Badge variant="outline">
                    {DIFFICULTY_LABELS[p.difficulty as Difficulty] ?? p.difficulty}
                  </Badge>
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {p.fen}
                </p>
                <p className="font-mono text-xs">Решение: {p.solution}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
