"use client";

import Link from "next/link";
import { Crown, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";

interface AppHeaderProps {
  name: string;
  role: "TEACHER" | "STUDENT";
}

/** Шапка для авторизованных страниц (кабинет, комната) */
export function AppHeader({ name, role }: AppHeaderProps) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="border-b bg-card/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-heading text-lg font-bold">
          <Crown className="size-5 text-primary" />
          Chess Duel
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-sm leading-tight">
              <div className="font-medium">{name}</div>
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                {role === "TEACHER" ? "Учитель" : "Ученик"}
              </Badge>
            </div>
          </div>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Выйти"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="size-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
