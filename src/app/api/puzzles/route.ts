/**
 * Учебные материалы учителя (пользовательские задачи).
 *
 * POST /api/puzzles — загрузить задачу (только учитель).
 * GET  /api/puzzles — список задач текущего учителя.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validatePuzzle } from "@/lib/validate-puzzle";

const THEMES = [
  "MATE_IN_1",
  "MATE_IN_2",
  "MATE_IN_3",
  "BACK_RANK",
  "FORK",
  "PIN",
  "SKEWER",
  "DISCOVERED",
  "SACRIFICE",
  "PROMOTION",
  "HANGING_PIECE",
  "ENDGAME",
] as const;

const createSchema = z.object({
  title: z.string().min(2, "Название слишком короткое").max(80),
  description: z.string().max(500).optional().default(""),
  fen: z.string().min(10, "Укажите FEN позиции"),
  solution: z.string().min(2, "Укажите решение"),
  theme: z.enum(THEMES),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return NextResponse.json(
      { error: "Загружать материалы может только учитель" },
      { status: 403 }
    );
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ошибка валидации" },
      { status: 400 }
    );
  }

  // Проверяем позицию и проигрываем решение через chess.js
  const check = validatePuzzle(parsed.data.fen, parsed.data.solution);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const puzzle = await prisma.puzzle.create({
    data: {
      title: parsed.data.title,
      description:
        parsed.data.description ||
        "Авторская задача преподавателя. Разберите решение вместе после раунда.",
      fen: parsed.data.fen.trim(),
      solution: check.data.solution,
      theme: parsed.data.theme,
      difficulty: parsed.data.difficulty,
      authorId: session.user.id,
    },
  });

  return NextResponse.json({ puzzle }, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const puzzles = await prisma.puzzle.findMany({
    where: { authorId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ puzzles });
}
