import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { LocalClient } from "./local-client";

export const metadata = { title: "Локальное занятие — Chess Duel" };

/**
 * Локальное занятие: несколько независимых игровых зон на одном экране.
 * Формат для очного класса — одно устройство (интерактивная доска,
 * проектор или планшет), 2–4 ученика решают одну задачу наперегонки.
 */
export default async function LocalPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/local");
  if (session.user.role !== "TEACHER") redirect("/dashboard");

  return (
    <div className="min-h-dvh bg-muted/30">
      <AppHeader name={session.user.name ?? "Учитель"} role={session.user.role} />
      <LocalClient />
    </div>
  );
}
