import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { RoomClient } from "./room-client";

export const metadata = { title: "Комната — Chess Duel" };

/**
 * Страница игровой комнаты. Серверная часть только проверяет авторизацию
 * и передаёт данные пользователя клиенту — вся игра идёт через Socket.io.
 */
export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { code } = await params;

  return (
    <RoomClient
      code={code.toUpperCase()}
      me={{
        id: session.user.id,
        name: session.user.name ?? "Игрок",
        role: session.user.role,
      }}
    />
  );
}
