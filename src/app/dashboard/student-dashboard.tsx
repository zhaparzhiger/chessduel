"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Award, CheckCircle2, Gamepad2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface HistoryRow {
  id: string;
  roomName: string;
  points: number;
  solved: number;
  place: number | null;
  date: string;
}

interface Props {
  stats: { totalPoints: number; totalSolved: number; games: number };
  history: HistoryRow[];
}

export function StudentDashboard({ stats, history }: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");

  function join(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) return;
    router.push(`/room/${clean}`);
  }

  const cards = [
    { icon: Trophy, label: "Всего очков", value: stats.totalPoints },
    { icon: CheckCircle2, label: "Решено задач", value: stats.totalSolved },
    { icon: Gamepad2, label: "Сыграно игр", value: stats.games },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 font-heading text-3xl font-bold">Мой кабинет</h1>

      {/* Присоединиться по коду */}
      <Card className="mb-8 border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="font-heading">Присоединиться к дуэли</CardTitle>
          <CardDescription>
            Введите код комнаты, который дал преподаватель.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={join} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="code">Код комнаты</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={8}
                className="font-mono text-lg tracking-widest"
              />
            </div>
            <Button type="submit" size="lg" disabled={code.trim().length < 4}>
              Войти
              <ArrowRight className="size-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Статистика */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex flex-col items-center gap-1 py-6 text-center">
              <c.icon className="size-6 text-primary" />
              <div className="font-heading text-2xl font-bold">{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* История игр */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Award className="size-5 text-primary" />
            История игр
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              Вы ещё не участвовали в дуэлях. Введите код выше и начните!
            </p>
          ) : (
            <ul className="divide-y">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{h.roomName}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(h.date).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {h.place && (
                      <Badge variant={h.place === 1 ? "default" : "secondary"}>
                        {h.place} место
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {h.solved} решено
                    </span>
                    <span className="font-heading font-bold text-primary">
                      {h.points}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
