/**
 * Перенос задач из локальной БД в удалённую (например, Neon при деплое).
 * Использование:
 *   $env:SOURCE_URL="postgresql://chessduel:chessduel@localhost:5434/chessduel"
 *   $env:TARGET_URL="<строка подключения удалённой БД>"
 *   npx tsx scripts/copy-puzzles.ts
 */
import { PrismaClient } from "@prisma/client";

const source = new PrismaClient({
  datasources: { db: { url: process.env.SOURCE_URL! } },
});
const target = new PrismaClient({
  datasources: { db: { url: process.env.TARGET_URL! } },
});

async function main() {
  // Только импортированные (lichessId != null): базовые задачи целевая БД
  // получает через свой seed, иначе появились бы дубликаты без уникального ключа
  const puzzles = await source.puzzle.findMany({
    where: { lichessId: { not: null } },
  });
  console.log(`Источник: ${puzzles.length} задач`);

  // createMany пачками; дубликаты по lichessId пропускаются
  const BATCH = 500;
  let copied = 0;
  for (let i = 0; i < puzzles.length; i += BATCH) {
    const chunk = puzzles.slice(i, i + BATCH).map(({ id, createdAt, ...rest }) => rest);
    const r = await target.puzzle.createMany({ data: chunk, skipDuplicates: true });
    copied += r.count;
    process.stdout.write(`\r  скопировано: ${copied}`);
  }
  const total = await target.puzzle.count();
  console.log(`\n✅ Готово. В целевой базе: ${total} задач`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
