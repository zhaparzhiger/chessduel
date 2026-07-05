/**
 * Расширяем типы Auth.js: добавляем поля id и role.
 */
import type { DefaultSession } from "next-auth";

type Role = "TEACHER" | "STUDENT";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
  }
}
