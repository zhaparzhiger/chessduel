/**
 * Edge-безопасная часть конфига Auth.js.
 *
 * Здесь НЕТ импортов Prisma / bcrypt — только то, что можно исполнять
 * в middleware (Edge runtime). Полная конфигурация с провайдером Credentials
 * живёт в auth.ts и наследует этот объект.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  // Провайдеры добавляются в auth.ts (Credentials требует Node-рантайм)
  providers: [],
  callbacks: {
    // Кладём id и роль в токен при логине
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: "TEACHER" | "STUDENT" }).role;
        token.sub = user.id;
      }
      return token;
    },
    // Прокидываем их в session, доступную на клиенте
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as "TEACHER" | "STUDENT";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
