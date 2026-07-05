"use client";

/**
 * LocalClient — оркестратор локального занятия (одно устройство).
 *
 * Фазы: setup (настройка) → playing (зоны решают) → summary (разбор) →
 * … → finished (победитель).
 *
 * Проверка ходов идёт на клиенте (решения загружаются заранее через
 * /api/puzzles/random — доступно только учителю).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Crown,
  Loader2,
  Minus,
  MonitorPlay,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";
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
import { GameTimer } from "@/components/game/game-timer";
import { LocalZone, type LocalPuzzle } from "@/components/local/local-zone";
import { DIFFICULTY_LABELS, THEME_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Difficulty, PuzzleTheme } from "@/types/game";

const ANY = "ANY";
const ATTEMPTS = 2;
const SUMMARY_PAUSE_MS = 7000;
const BASE_POINTS: Record<string, number> = { EASY: 100, MEDIUM: 150, HARD: 200 };
const FIRST_BONUS = 25;
const MAX_TIME_BONUS = 50;
const RETRY_PENALTY = 0.3;

interface FetchedPuzzle extends LocalPuzzle {
  theme: string;
  difficulty: string;
}

type Outcome = "solved" | "failed" | "missed";

interface PlayerState {
  name: string;
  points: number;
  solved: number;
  history: Outcome[];
}

type Phase = "setup" | "loading" | "playing" | "summary" | "finished";

export function LocalClient() {
  // ─────────── Настройки ───────────
  const [names, setNames] = useState<string[]>(["Игрок 1", "Игрок 2"]);
  const [theme, setTheme] = useState<PuzzleTheme | typeof ANY>(ANY);
  const [difficulty, setDifficulty] = useState<Difficulty | typeof ANY>(ANY);
  const [source, setSource] = useState<"all" | "mine" | "base">("all");
  const [count, setCount] = useState(5);
  const [seconds, setSeconds] = useState(60);

  // ─────────── Игровое состояние ───────────
  const [phase, setPhase] = useState<Phase>("setup");
  const [puzzles, setPuzzles] = useState<FetchedPuzzle[]>([]);
  const [idx, setIdx] = useState(0);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [deadline, setDeadline] = useState<number | null>(null);
  // Текущий раунд: статус каждой зоны
  const roundRef = useRef<{ done: boolean[]; solvedOrder: number[] }>({
    done: [],
    solvedOrder: [],
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const puzzle = puzzles[idx] ?? null;

  // ─────────── Управление раундами ───────────

  const endRound = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setDeadline(null);
    // Не закончившие раунд получают «missed» (решившие/провалившие
    // уже дописали свой итог в handleSolved/handleFailed)
    setPlayers((prev) =>
      prev.map((p) =>
        p.history.length > idxRef.current
          ? p
          : { ...p, history: [...p.history, "missed" as Outcome] }
      )
    );
    setPhase("summary");
    timerRef.current = setTimeout(() => {
      if (idxRef.current + 1 >= puzzlesRef.current.length) {
        setPhase("finished");
      } else {
        startRound(idxRef.current + 1);
      }
    }, SUMMARY_PAUSE_MS);
  }, []);

  // Рефы для доступа к актуальным значениям из колбэков/таймеров
  const idxRef = useRef(0);
  const puzzlesRef = useRef<FetchedPuzzle[]>([]);
  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);
  useEffect(() => {
    puzzlesRef.current = puzzles;
  }, [puzzles]);

  const startRound = useCallback((roundIdx: number) => {
    roundRef.current = {
      done: new Array(namesCountRef.current).fill(false),
      solvedOrder: [],
    };
    setIdx(roundIdx);
    idxRef.current = roundIdx;
    setPhase("playing");
    const dl = Date.now() + secondsRef.current * 1000;
    setDeadline(dl);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => endRound(), secondsRef.current * 1000);
  }, [endRound]);

  const namesCountRef = useRef(2);
  const secondsRef = useRef(60);

  // ─────────── Старт занятия ───────────
  async function startLesson() {
    const cleanNames = names.map((n, i) => n.trim() || `Игрок ${i + 1}`);
    setPhase("loading");
    try {
      const params = new URLSearchParams({ count: String(count), source });
      if (theme !== ANY) params.set("theme", theme);
      if (difficulty !== ANY) params.set("difficulty", difficulty);
      const res = await fetch(`/api/puzzles/random?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки задач");
      if (!data.puzzles?.length) {
        toast.error("Нет задач под выбранные фильтры — измените тему/источник");
        setPhase("setup");
        return;
      }
      const fetched: FetchedPuzzle[] = data.puzzles.map(
        (p: { id: string; title: string; description: string; fen: string; solution: string; theme: string; difficulty: string }) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          fen: p.fen,
          moves: p.solution.split(/\s+/),
          theme: p.theme,
          difficulty: p.difficulty,
        })
      );
      setPuzzles(fetched);
      puzzlesRef.current = fetched;
      setPlayers(cleanNames.map((name) => ({ name, points: 0, solved: 0, history: [] })));
      namesCountRef.current = cleanNames.length;
      secondsRef.current = seconds;
      startRound(0);
    } catch (e) {
      toast.error((e as Error).message);
      setPhase("setup");
    }
  }

  // ─────────── События зон ───────────
  function handleSolved(zoneIdx: number, retriesUsed: number) {
    const dl = deadline ?? Date.now();
    const remaining = Math.max(0, dl - Date.now());
    const p = puzzlesRef.current[idxRef.current];
    const base = BASE_POINTS[p.difficulty] ?? 100;
    const timeBonus = Math.round((remaining / (secondsRef.current * 1000)) * MAX_TIME_BONUS);
    const first = roundRef.current.solvedOrder.length === 0 ? FIRST_BONUS : 0;
    const points = Math.max(
      10,
      Math.round((base + timeBonus + first) * (1 - RETRY_PENALTY * retriesUsed))
    );

    roundRef.current.solvedOrder.push(zoneIdx);
    roundRef.current.done[zoneIdx] = true;
    setPlayers((prev) =>
      prev.map((pl, i) =>
        i === zoneIdx
          ? {
              ...pl,
              points: pl.points + points,
              solved: pl.solved + 1,
              history: [...pl.history, "solved" as Outcome],
            }
          : pl
      )
    );
    toast.success(`${players[zoneIdx]?.name ?? "Игрок"} решает задачу! +${points}`);
    maybeEndEarly();
  }

  function handleFailed(zoneIdx: number) {
    roundRef.current.done[zoneIdx] = true;
    setPlayers((prev) =>
      prev.map((pl, i) =>
        i === zoneIdx ? { ...pl, history: [...pl.history, "failed" as Outcome] } : pl
      )
    );
    maybeEndEarly();
  }

  function maybeEndEarly() {
    if (roundRef.current.done.every(Boolean)) {
      // небольшая пауза, чтобы увидеть оверлей последней зоны
      setTimeout(() => endRound(), 800);
    }
  }

  // Очистка таймеров при размонтировании
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function resetAll() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase("setup");
    setPuzzles([]);
    setIdx(0);
    setDeadline(null);
  }

  // ═══════════════ РЕНДЕР ═══════════════

  if (phase === "setup" || phase === "loading") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 text-center">
          <MonitorPlay className="mx-auto mb-2 size-10 text-primary" />
          <h1 className="font-heading text-3xl font-bold">Локальное занятие</h1>
          <p className="text-muted-foreground">
            Одно устройство — несколько игровых зон. Идеально для класса с
            проектором или интерактивной доской.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Настройка</CardTitle>
            <CardDescription>
              2–4 участника решают одни и те же задачи каждый на своей доске.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Участники ({names.length})</Label>
              {names.map((n, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={n}
                    onChange={(e) =>
                      setNames((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                    }
                    placeholder={`Игрок ${i + 1}`}
                  />
                  {names.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Убрать игрока"
                      onClick={() => setNames((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {names.length < 4 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNames((prev) => [...prev, `Игрок ${prev.length + 1}`])}
                >
                  + Добавить игрока
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Тема задач</Label>
                <Select value={theme} onValueChange={(v) => setTheme(v as PuzzleTheme)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Любая</SelectItem>
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
                    <SelectItem value={ANY}>Любая</SelectItem>
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
              <Label>Источник задач</Label>
              <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Общая база + мои задачи</SelectItem>
                  <SelectItem value="base">Только общая база</SelectItem>
                  <SelectItem value="mine">Только мои задачи</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="l-count">Количество задач</Label>
                <Input
                  id="l-count"
                  type="number"
                  min={1}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="l-sec">Секунд на задачу</Label>
                <Input
                  id="l-sec"
                  type="number"
                  min={15}
                  max={300}
                  step={5}
                  value={seconds}
                  onChange={(e) => setSeconds(Number(e.target.value))}
                />
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={phase === "loading"}
              onClick={startLesson}
            >
              {phase === "loading" ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <MonitorPlay className="size-5" />
              )}
              Начать занятие
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (phase === "finished") {
    const ranked = [...players].sort((a, b) => b.points - a.points || b.solved - a.solved);
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 text-center">
          <Trophy className="mx-auto mb-2 size-12 text-yellow-500" />
          <h1 className="font-heading text-3xl font-bold">Занятие завершено!</h1>
          {ranked[0] && (
            <p className="mt-1 text-lg">
              Победитель: <span className="font-bold text-primary">{ranked[0].name}</span>{" "}
              🎉
            </p>
          )}
        </div>

        <Card>
          <CardContent className="space-y-2 pt-6">
            {ranked.map((p, i) => (
              <div
                key={p.name + i}
                className={cn(
                  "rounded-lg px-3 py-2",
                  i === 0 && "bg-yellow-500/10 ring-1 ring-yellow-500/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center font-heading font-bold">
                    {i === 0 ? <Crown className="size-4 text-yellow-500" /> : i + 1}
                  </span>
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {p.solved} из {puzzles.length}
                  </span>
                  <span className="w-14 text-right font-heading font-bold text-primary">
                    {p.points}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1 pl-8">
                  {p.history.map((o, j) => (
                    <span
                      key={j}
                      title={puzzles[j]?.title}
                      className={cn(
                        "inline-flex size-5 items-center justify-center rounded-full",
                        o === "solved" && "bg-green-500/15 text-green-600 dark:text-green-400",
                        o === "failed" && "bg-red-500/15 text-red-600 dark:text-red-400",
                        o === "missed" && "bg-muted text-muted-foreground"
                      )}
                    >
                      {o === "solved" ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : o === "failed" ? (
                        <X className="size-3" strokeWidth={3} />
                      ) : (
                        <Minus className="size-3" strokeWidth={3} />
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button className="mt-4 w-full" size="lg" onClick={resetAll}>
          <RotateCcw className="size-4" />
          Новое занятие
        </Button>
      </main>
    );
  }

  // ─────────── playing / summary ───────────
  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      {/* Шапка раунда */}
      <Card className="mb-4">
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-muted-foreground">
                Задача {idx + 1} из {puzzles.length}
              </div>
              <h2 className="font-heading text-xl font-bold">{puzzle?.title}</h2>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">
                {THEME_LABELS[puzzle?.theme as PuzzleTheme] ?? puzzle?.theme}
              </Badge>
              <Badge variant="outline">
                {DIFFICULTY_LABELS[puzzle?.difficulty as Difficulty] ?? puzzle?.difficulty}
              </Badge>
              <Badge className="bg-foreground text-background">
                Ход {puzzle?.fen.split(" ")[1] === "b" ? "чёрных" : "белых"}
              </Badge>
            </div>
          </div>
          {phase === "playing" && deadline && (
            <GameTimer deadline={deadline} totalSeconds={secondsRef.current} />
          )}
        </CardContent>
      </Card>

      {/* Разбор между задачами */}
      {phase === "summary" && puzzle && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="pt-5">
            <div className="font-heading font-semibold">Разбор</div>
            <p className="mt-1 font-mono text-sm">Решение: {puzzle.moves.join(" ")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{puzzle.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Следующая задача через несколько секунд…
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─────────── Игровые зоны ─────────── */}
      <div
        className={cn(
          "grid gap-4",
          players.length === 2 && "sm:grid-cols-2",
          players.length === 3 && "sm:grid-cols-2 xl:grid-cols-3",
          players.length === 4 && "sm:grid-cols-2 xl:grid-cols-4"
        )}
      >
        {players.map((p, i) =>
          puzzle ? (
            <LocalZone
              key={`${puzzle.id}-${i}`}
              playerName={p.name}
              points={p.points}
              puzzle={puzzle}
              active={phase === "playing"}
              attemptsPerPuzzle={ATTEMPTS}
              onSolved={(retries) => handleSolved(i, retries)}
              onFailed={() => handleFailed(i)}
            />
          ) : null
        )}
      </div>
    </main>
  );
}
