/**
 * GET /api/puzzles/random — случайный набор задач С РЕШЕНИЯМИ.
 *
 * Используется локальным занятием (несколько игровых зон на одном устройстве):
 * проверка ходов там выполняется на клиенте, поэтому решения нужны сразу.
 * Доступ — только учителю (ученикам решения не выдаются никогда).
 *
 * Параметры: count (1–20), theme?, difficulty?, source = all | mine | base
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return NextResponse.json(
      { error: "Доступно только учителю" },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const count = Math.min(20, Math.max(1, Number(url.searchParams.get("count")) || 5));
  const theme = url.searchParams.get("theme");
  const difficulty = url.searchParams.get("difficulty");
  const source = url.searchParams.get("source") ?? "all";

  const conditions: Prisma.Sql[] = [];
  if (theme) conditions.push(Prisma.sql`theme::text = ${theme}`);
  if (difficulty) conditions.push(Prisma.sql`difficulty::text = ${difficulty}`);
  if (source === "mine") {
    conditions.push(Prisma.sql`"authorId" = ${session.user.id}`);
  } else if (source === "base") {
    conditions.push(Prisma.sql`"authorId" IS NULL`);
  } else {
    // all: общая база + мои материалы (чужие авторские не показываем)
    conditions.push(
      Prisma.sql`("authorId" IS NULL OR "authorId" = ${session.user.id})`
    );
  }

  const where =
    conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      : Prisma.empty;

  const puzzles = await prisma.$queryRaw<
    {
      id: string;
      title: string;
      description: string;
      fen: string;
      solution: string;
      theme: string;
      difficulty: string;
    }[]
  >`
    SELECT id, title, description, fen, solution, theme::text AS theme, difficulty::text AS difficulty
    FROM puzzles
    ${where}
    ORDER BY RANDOM()
    LIMIT ${count}
  `;

  return NextResponse.json({ puzzles });
}
