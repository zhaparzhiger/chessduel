/**
 * DELETE /api/puzzles/:id — удалить свою задачу (только автор).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const puzzle = await prisma.puzzle.findUnique({ where: { id } });
  if (!puzzle || puzzle.authorId !== session.user.id) {
    return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
  }

  await prisma.puzzle.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
