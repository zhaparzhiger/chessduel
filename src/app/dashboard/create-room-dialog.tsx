"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DIFFICULTY_LABELS,
  MODE_HINTS,
  MODE_LABELS,
  THEME_LABELS,
} from "@/lib/labels";
import type { Difficulty, GameMode, PuzzleTheme, RoomStatus } from "@/types/game";

interface CreatedRoom {
  id: string;
  code: string;
  name: string;
  status: RoomStatus;
  mode: GameMode;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (room: CreatedRoom) => void;
}

const ANY = "ANY"; // «любая тема / сложность»

export function CreateRoomDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<GameMode>("DUEL");
  const [theme, setTheme] = useState<PuzzleTheme | typeof ANY>(ANY);
  const [difficulty, setDifficulty] = useState<Difficulty | typeof ANY>(ANY);
  const [puzzleCount, setPuzzleCount] = useState(5);
  const [secondsPerPuzzle, setSecondsPerPuzzle] = useState(60);
  const [customOnly, setCustomOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mode,
          theme: theme === ANY ? null : theme,
          difficulty: difficulty === ANY ? null : difficulty,
          puzzleCount,
          secondsPerPuzzle,
          customOnly,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Не удалось создать комнату");
        return;
      }
      toast.success(`Комната создана! Код: ${data.room.code}`);
      onCreated(data.room);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Новая комната</DialogTitle>
          <DialogDescription>
            Настройте параметры дуэли. Ученики войдут по коду.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room-name">Название</Label>
            <Input
              id="room-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: 5А — тактика"
            />
          </div>

          <div className="space-y-2">
            <Label>Режим</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as GameMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MODE_LABELS) as GameMode[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{MODE_HINTS[mode]}</p>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="count">Количество задач</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={20}
                value={puzzleCount}
                onChange={(e) => setPuzzleCount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seconds">Секунд на задачу</Label>
              <Input
                id="seconds"
                type="number"
                min={15}
                max={300}
                step={5}
                value={secondsPerPuzzle}
                onChange={(e) => setSecondsPerPuzzle(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="custom-only">Только мои задачи</Label>
              <p className="text-xs text-muted-foreground">
                Использовать материалы из раздела «Мои задачи»
              </p>
            </div>
            <Switch
              id="custom-only"
              checked={customOnly}
              onCheckedChange={setCustomOnly}
            />
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Создать комнату
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
