/**
 * POST /api/rooms — создать комнату (только учитель).
 * GET  /api/rooms — список комнат, созданных текущим учителем.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateRoomCode } from "@/lib/room-code";

const createSchema = z.object({
  name: z.string().min(2, "Название слишком короткое").max(60),
  mode: z.enum(["DUEL", "TEAM", "BATTLE_ROYALE"]),
  theme: z
    .enum([
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
    ])
    .nullable()
    .optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).nullable().optional(),
  puzzleCount: z.number().int().min(1).max(20),
  secondsPerPuzzle: z.number().int().min(15).max(300),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return NextResponse.json(
      { error: "Создавать комнаты может только учитель" },
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

  // Проверяем, что для выбранных фильтров есть хотя бы одна задача
  const available = await prisma.puzzle.count({
    where: {
      ...(parsed.data.theme ? { theme: parsed.data.theme } : {}),
      ...(parsed.data.difficulty ? { difficulty: parsed.data.difficulty } : {}),
    },
  });
  if (available === 0) {
    return NextResponse.json(
      { error: "Нет задач под выбранные тему и сложность" },
      { status: 400 }
    );
  }

  // Гарантируем уникальность кода (несколько попыток на случай коллизии)
  let code = generateRoomCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.room.findUnique({ where: { code } });
    if (!clash) break;
    code = generateRoomCode();
  }

  const room = await prisma.room.create({
    data: {
      code,
      name: parsed.data.name,
      mode: parsed.data.mode,
      theme: parsed.data.theme ?? null,
      difficulty: parsed.data.difficulty ?? null,
      puzzleCount: parsed.data.puzzleCount,
      secondsPerPuzzle: parsed.data.secondsPerPuzzle,
      hostId: session.user.id,
    },
  });

  return NextResponse.json({ room }, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const rooms = await prisma.room.findMany({
    where: { hostId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ rooms });
}
