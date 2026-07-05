/**
 * Seed: демо-аккаунты + стартовая база шахматных задач.
 * Запуск: npm run db:seed
 *
 * Формат solution: ходы в SAN через пробел.
 * Чётные индексы (0, 2, ...) — ходы игрока, нечётные — автоответы соперника.
 */
import { PrismaClient, PuzzleTheme, Difficulty, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const puzzles = [
  {
    title: "Мат по последней горизонтали",
    description:
      "Классический мат по 8-й горизонтали: ладья врывается на e8, а собственные пешки не дают чёрному королю сбежать.",
    fen: "6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1",
    solution: "Re8#",
    theme: PuzzleTheme.MATE_IN_1,
    difficulty: Difficulty.EASY,
    rating: 800,
  },
  {
    title: "Детский мат",
    description:
      "Ферзь бьёт на f7 под защитой слона c4. Королю некуда бежать: поле d8 занято собственным ферзём.",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1",
    solution: "Qxf7#",
    theme: PuzzleTheme.MATE_IN_1,
    difficulty: Difficulty.EASY,
    rating: 900,
  },
  {
    title: "Ладья и король",
    description:
      "Белый король отнимает поля a7 и b7, ладье остаётся дать шах по 8-й горизонтали — это мат.",
    fen: "k7/8/1K6/8/8/8/8/7R w - - 0 1",
    solution: "Rh8#",
    theme: PuzzleTheme.MATE_IN_1,
    difficulty: Difficulty.EASY,
    rating: 700,
  },
  {
    title: "Диагональ и вертикаль",
    description:
      "Шах по большой диагонали выгоняет короля на g8, после чего ферзь ставит мат по 8-й горизонтали: все поля отхода контролирует белый король.",
    fen: "7k/8/6K1/8/8/8/8/6Q1 w - - 0 1",
    solution: "Qa1+ Kg8 Qa8#",
    theme: PuzzleTheme.MATE_IN_2,
    difficulty: Difficulty.MEDIUM,
    rating: 1200,
  },
  {
    title: "Лестница из ладей",
    description:
      "Одна ладья отрезает 7-ю горизонталь, вторая ставит мат по 8-й. Классический «лестничный» механизм двумя ладьями.",
    fen: "4k3/8/8/8/8/8/1R6/R3K3 w - - 0 1",
    solution: "Rb7 Kd8 Ra8#",
    theme: PuzzleTheme.MATE_IN_2,
    difficulty: Difficulty.MEDIUM,
    rating: 1100,
  },
  {
    title: "Королевская вилка",
    description:
      "Конь с шахом прыгает на c7 и одновременно нападает на короля и ладью a8. После отхода короля конь забирает ладью.",
    fen: "r3k3/5ppp/8/1N6/8/8/5PPP/4K3 w - - 0 1",
    solution: "Nc7+ Kd7 Nxa8",
    theme: PuzzleTheme.FORK,
    difficulty: Difficulty.MEDIUM,
    rating: 1000,
  },
  {
    title: "Конь открывает огонь",
    description:
      "Конь уходит с d5 с шахом, вскрывая линию «d». Чем бы чёрные ни ответили, ладья забирает ферзя на d8.",
    fen: "3q2k1/5ppp/8/3N4/8/8/8/3R2K1 w - - 0 1",
    solution: "Nf6+ gxf6 Rxd8+",
    theme: PuzzleTheme.DISCOVERED,
    difficulty: Difficulty.HARD,
    rating: 1500,
  },
  {
    title: "Связанный конь обречён",
    description:
      "Конь d5 связан по линии «d»: уйти — значит подставить ферзя под ладью. Пешка e4 нападает на связанную фигуру, и чёрные теряют материал.",
    fen: "3qk3/5ppp/8/3n4/8/8/4PPPP/3R2K1 w - - 0 1",
    solution: "e4 Nf4 Rxd8+",
    theme: PuzzleTheme.PIN,
    difficulty: Difficulty.MEDIUM,
    rating: 1300,
  },
  {
    title: "Ферзь с доставкой",
    description:
      "Пешка превращается в ферзя с шахом по диагонали g8–b3. Новорождённый ферзь сразу решает партию.",
    fen: "8/6P1/8/8/8/1k6/8/1K6 w - - 0 1",
    solution: "g8=Q+",
    theme: PuzzleTheme.ENDGAME,
    difficulty: Difficulty.EASY,
    rating: 800,
  },
  {
    title: "Линейный удар",
    description:
      "Шах по 5-й горизонтали заставляет короля отойти, и ладья забирает ферзя на b5. Классический «рентген» в эндшпиле.",
    fen: "8/8/8/1q2k3/8/8/6K1/7R w - - 0 1",
    solution: "Rh5+ Kd4 Rxb5",
    theme: PuzzleTheme.ENDGAME,
    difficulty: Difficulty.MEDIUM,
    rating: 1200,
  },
];

async function main() {
  console.log("🌱 Seeding database...");

  // Демо-аккаунты для быстрого старта
  const teacherPassword = await bcrypt.hash("teacher123", 10);
  const studentPassword = await bcrypt.hash("student123", 10);

  await prisma.user.upsert({
    where: { email: "teacher@chessduel.ru" },
    update: {},
    create: {
      name: "Мария Петровна",
      email: "teacher@chessduel.ru",
      passwordHash: teacherPassword,
      role: Role.TEACHER,
    },
  });

  for (const [i, name] of ["Алиса", "Тимур", "Соня"].entries()) {
    await prisma.user.upsert({
      where: { email: `student${i + 1}@chessduel.ru` },
      update: {},
      create: {
        name,
        email: `student${i + 1}@chessduel.ru`,
        passwordHash: studentPassword,
        role: Role.STUDENT,
      },
    });
  }

  // Задачи: пересоздаём, чтобы seed был идемпотентным
  for (const p of puzzles) {
    const existing = await prisma.puzzle.findFirst({ where: { fen: p.fen } });
    if (existing) {
      await prisma.puzzle.update({ where: { id: existing.id }, data: p });
    } else {
      await prisma.puzzle.create({ data: p });
    }
  }

  console.log(`✅ Seeded ${puzzles.length} puzzles + 4 demo users`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
