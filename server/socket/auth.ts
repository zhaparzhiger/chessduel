/**
 * Авторизация Socket.io-подключений.
 * Сокет и Next.js живут на одном origin, поэтому браузер сам шлёт
 * сессионную куку NextAuth — декодируем её JWT и получаем пользователя.
 */
import { decode } from "next-auth/jwt";
import type { Socket } from "socket.io";

export interface SocketUser {
  id: string;
  name: string;
  role: "TEACHER" | "STUDENT";
}

/** Имена сессионной куки Auth.js (http / https) */
const COOKIE_NAMES = ["authjs.session-token", "__Secure-authjs.session-token"];

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

/** Достаёт пользователя из куки; null — если не авторизован */
export async function authenticateSocket(socket: Socket): Promise<SocketUser | null> {
  const cookies = parseCookies(socket.handshake.headers.cookie);
  for (const name of COOKIE_NAMES) {
    const raw = cookies[name];
    if (!raw) continue;
    try {
      const token = await decode({
        token: raw,
        secret: process.env.AUTH_SECRET!,
        salt: name, // в Auth.js v5 salt = имя куки
      });
      if (token?.sub && token.role) {
        return {
          id: token.sub,
          name: (token.name as string) ?? "Игрок",
          role: token.role as SocketUser["role"],
        };
      }
    } catch {
      // повреждённый/просроченный токен — пробуем следующее имя куки
    }
  }
  return null;
}
