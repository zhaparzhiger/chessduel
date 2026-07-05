"use client";

/**
 * Клиентские провайдеры приложения:
 *  - SessionProvider (Auth.js) — доступ к сессии на клиенте
 *  - ThemeProvider (next-themes) — тёмная/светлая тема с сохранением выбора
 */
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
