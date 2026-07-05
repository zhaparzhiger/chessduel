import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import { TeacherDashboard } from "./teacher-dashboard";
import { StudentDashboard } from "./student-dashboard";

export const metadata = { title: "Кабинет — Chess Duel" };

/**
 * Кабинет. Учителю показываем управление комнатами,
 * ученику — присоединение по коду и его статистику.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id, name, role } = session.user;

  if (role === "TEACHER") {
    const rooms = await prisma.room.findMany({
      where: { hostId: id },
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    return (
      <div className="min-h-dvh bg-muted/30">
        <AppHeader name={name ?? "Учитель"} role={role} />
        <TeacherDashboard
          initialRooms={rooms.map((r) => ({
            id: r.id,
            code: r.code,
            name: r.name,
            status: r.status,
            mode: r.mode,
          }))}
        />
      </div>
    );
  }

  // Ученик: агрегированная статистика по прошлым сессиям
  const results = await prisma.playerResult.findMany({
    where: { userId: id },
    include: { session: { include: { room: true } } },
    orderBy: { session: { startedAt: "desc" } },
    take: 10,
  });
  const totalPoints = results.reduce((s, r) => s + r.points, 0);
  const totalSolved = results.reduce((s, r) => s + r.solved, 0);

  return (
    <div className="min-h-dvh bg-muted/30">
      <AppHeader name={name ?? "Ученик"} role={role} />
      <StudentDashboard
        stats={{ totalPoints, totalSolved, games: results.length }}
        history={results.map((r) => ({
          id: r.id,
          roomName: r.session.room.name,
          points: r.points,
          solved: r.solved,
          place: r.place,
          date: r.session.startedAt.toISOString(),
        }))}
      />
    </div>
  );
}
