import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import { PuzzlesClient } from "./puzzles-client";

export const metadata = { title: "Мои задачи — Chess Duel" };

/**
 * Учебные материалы учителя: загрузка и управление собственными задачами.
 * Эти задачи можно использовать в онлайн-комнатах («только мои задачи»)
 * и в локальном занятии.
 */
export default async function PuzzlesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/puzzles");
  if (session.user.role !== "TEACHER") redirect("/dashboard");

  const puzzles = await prisma.puzzle.findMany({
    where: { authorId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-dvh bg-muted/30">
      <AppHeader name={session.user.name ?? "Учитель"} role={session.user.role} />
      <PuzzlesClient
        initialPuzzles={puzzles.map((p) => ({
          id: p.id,
          title: p.title,
          fen: p.fen,
          solution: p.solution,
          theme: p.theme,
          difficulty: p.difficulty,
        }))}
      />
    </div>
  );
}
