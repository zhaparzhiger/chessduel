"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateRoomDialog } from "./create-room-dialog";
import { MODE_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { GameMode, RoomStatus } from "@/types/game";

interface RoomRow {
  id: string;
  code: string;
  name: string;
  status: RoomStatus;
  mode: GameMode;
}

const STATUS_VARIANT: Record<RoomStatus, "default" | "secondary" | "outline"> = {
  LOBBY: "default",
  PLAYING: "secondary",
  FINISHED: "outline",
};

export function TeacherDashboard({ initialRooms }: { initialRooms: RoomRow[] }) {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomRow[]>(initialRooms);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Мои комнаты</h1>
          <p className="text-muted-foreground">
            Создавайте комнаты и запускайте дуэли для учеников.
          </p>
        </div>
        <Button size="lg" onClick={() => setDialogOpen(true)}>
          <Plus className="size-5" />
          Создать комнату
        </Button>
      </div>

      {rooms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <DoorOpen className="size-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              У вас пока нет комнат. Создайте первую!
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              Создать комнату
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <Card
              key={room.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => router.push(`/room/${room.code}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="font-heading">{room.name}</CardTitle>
                  <Badge variant={STATUS_VARIANT[room.status]}>
                    {STATUS_LABELS[room.status]}
                  </Badge>
                </div>
                <CardDescription>{MODE_LABELS[room.mode]}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Код входа</span>
                  <span className="font-mono text-lg font-bold tracking-widest">
                    {room.code}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateRoomDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(room) => {
          setRooms((prev) => [room, ...prev]);
          router.push(`/room/${room.code}`);
        }}
      />
    </main>
  );
}
