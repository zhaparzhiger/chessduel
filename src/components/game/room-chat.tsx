"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/types/game";

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  meId?: string;
}

/** Чат комнаты (опциональная функция) */
export function RoomChat({ messages, onSend, meId }: Props) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Автопрокрутка вниз при новом сообщении
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    onSend(clean);
    setText("");
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg">Чат</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden">
        <div
          ref={scrollRef}
          className="h-48 flex-1 space-y-2 overflow-y-auto pr-1"
        >
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Сообщений пока нет
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className="text-sm">
              <span
                className={
                  m.userId === meId
                    ? "font-semibold text-primary"
                    : "font-semibold"
                }
              >
                {m.name}:
              </span>{" "}
              <span className="text-muted-foreground">{m.text}</span>
            </div>
          ))}
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Сообщение…"
            maxLength={300}
          />
          <Button type="submit" size="icon" aria-label="Отправить">
            <Send className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
