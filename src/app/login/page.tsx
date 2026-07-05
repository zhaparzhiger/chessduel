import { Suspense } from "react";
import Link from "next/link";
import { Crown, Loader2 } from "lucide-react";
import { LoginForm } from "./login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = { title: "Вход — Chess Duel" };

export default function LoginPage() {
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
        {/* useSearchParams внутри формы требует Suspense при пререндере */}
        <Suspense fallback={<Loader2 className="size-8 animate-spin text-primary" />}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
