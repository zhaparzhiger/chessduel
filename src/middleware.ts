/**
 * Middleware защиты роутов: /dashboard/** и /room/** требуют логина.
 * Неавторизованных отправляем на /login.
 *
 * Используем edge-безопасный authConfig (без Prisma/bcrypt) — в middleware
 * достаточно прочитать JWT из куки.
 */
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const PROTECTED = ["/dashboard", "/room", "/local", "/puzzles"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));

  if (isProtected && !req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  // Не трогаем статику, картинки и API (у API своя защита)
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
