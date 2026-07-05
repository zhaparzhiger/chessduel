import Link from "next/link";
import { Crown } from "lucide-react";
import { RegisterForm } from "./register-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = { title: "Регистрация — Chess Duel" };

export default function RegisterPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-background to-muted/40">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-2 font-heading text-xl font-bold">
          <Crown className="size-6 text-primary" />
          Chess Duel
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <RegisterForm />
      </main>
    </div>
  );
}
