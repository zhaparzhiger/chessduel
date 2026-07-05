/**
 * Полная конфигурация Auth.js (NextAuth v5).
 *
 * Наследует edge-безопасный authConfig и добавляет провайдер Credentials
 * (email + пароль, хеш bcrypt в БД) — он требует Node-рантайма.
 *
 * Роль пользователя (TEACHER/STUDENT) кладётся в JWT, чтобы её мог прочитать
 * и Socket.io-сервер (server/socket/auth.ts), и клиент.
 *
 * Чтобы добавить Google: раскомментируйте провайдер и переменные окружения.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
// import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // То, что вернём здесь, попадёт в jwt-колбэк как `user`
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
    // Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }),
  ],
});
