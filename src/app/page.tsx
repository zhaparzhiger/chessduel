import Link from "next/link";
import { Crown, Swords, Timer, Trophy, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { auth } from "@/lib/auth";

/**
 * Лендинг: краткое описание платформы + вход.
 * Если пользователь уже вошёл — предлагаем перейти в кабинет.
 */
export default async function Home() {
  const session = await auth();

  const features = [
    {
      icon: Swords,
      title: "Реал-тайм дуэли",
      text: "Ученики решают одну задачу одновременно и соревнуются за первое место.",
    },
    {
      icon: Timer,
      title: "Таймер и очки",
      text: "Баллы за скорость и точность. Бонус тому, кто решил первым.",
    },
    {
      icon: Trophy,
      title: "Живой лидерборд",
      text: "Рейтинг обновляется мгновенно — виден каждый решённый ход.",
    },
    {
      icon: Users,
      title: "Три режима",
      text: "Дуэль, командный бой и королевская битва на выбывание.",
    },
  ];

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/40">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2 font-heading text-xl font-bold">
          <Crown className="size-6 text-primary" />
          Chess Duel
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session?.user ? (
            <Button asChild>
              <Link href="/dashboard">В кабинет</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Войти</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Регистрация</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        <section className="flex flex-col items-center gap-6 py-16 text-center sm:py-24">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            <Zap className="size-4 text-primary" />
            Шахматные задачи в реальном времени
          </div>
          <h1 className="max-w-3xl font-heading text-4xl font-extrabold tracking-tight sm:text-6xl">
            Превратите урок шахмат в{" "}
            <span className="text-primary">захватывающую дуэль</span>
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Учитель создаёт комнату, ученики присоединяются по коду и решают
            тактические задачи наперегонки. Мгновенная обратная связь, объяснения
            и живой рейтинг.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href={session?.user ? "/dashboard" : "/register"}>
                Начать бесплатно
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">У меня есть код комнаты</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <f.icon className="mb-3 size-8 text-primary" />
              <h3 className="mb-1 font-heading font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Chess Duel — образовательная платформа для тренеров и учеников.
      </footer>
    </div>
  );
}
