/**
 * Импорт задач из открытой базы Lichess (https://database.lichess.org/#puzzles).
 *
 * Запуск: npm run db:import              (по умолчанию 150 задач на каждую
 *         npm run db:import -- 300        комбинацию тема×сложность)
 *
 * Как работает:
 *  1. Стримингово скачивает lichess_db_puzzle.csv.zst (НЕ сохраняя весь файл),
 *     декомпрессия zstd на лету через fzstd.
 *  2. Фильтрует качественные задачи (популярность, число игр, точность рейтинга).
 *  3. Конвертирует формат Lichess в наш:
 *     - FEN Lichess — позиция ДО хода соперника; первый ход из Moves — «подводка»,
 *       мы применяем его и получаем стартовую позицию задачи;
 *     - остальные ходы UCI → SAN через chess.js (чётные — игрок, нечётные — ответ).
 *  4. Набирает квоту на каждую пару тема×сложность и останавливает скачивание,
 *     как только все квоты заполнены.
 *  5. Пишет в БД пачками; lichessId уникален — повторный запуск не создаёт дублей.
 */
import { Chess } from "chess.js";
import { Decompress } from "fzstd";
import { PrismaClient, PuzzleTheme, Difficulty } from "@prisma/client";

const prisma = new PrismaClient();

const URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst";

/** Квота задач на каждую комбинацию тема×сложность (аргумент CLI) */
const PER_BUCKET = Number(process.argv[2]) || 150;

/** Маппинг тем Lichess → наши темы (в порядке приоритета: специфичные раньше общих) */
const THEME_MAP: [string, PuzzleTheme][] = [
  ["mateIn1", PuzzleTheme.MATE_IN_1],
  ["mateIn2", PuzzleTheme.MATE_IN_2],
  ["mateIn3", PuzzleTheme.MATE_IN_3],
  ["backRankMate", PuzzleTheme.BACK_RANK],
  ["fork", PuzzleTheme.FORK],
  ["pin", PuzzleTheme.PIN],
  ["skewer", PuzzleTheme.SKEWER],
  ["discoveredAttack", PuzzleTheme.DISCOVERED],
  ["sacrifice", PuzzleTheme.SACRIFICE],
  ["promotion", PuzzleTheme.PROMOTION],
  ["hangingPiece", PuzzleTheme.HANGING_PIECE],
  ["endgame", PuzzleTheme.ENDGAME],
];

const TITLE: Record<PuzzleTheme, string> = {
  MATE_IN_1: "Мат в 1 ход",
  MATE_IN_2: "Мат в 2 хода",
  MATE_IN_3: "Мат в 3 хода",
  BACK_RANK: "Мат по последней горизонтали",
  FORK: "Двойной удар",
  PIN: "Связка",
  SKEWER: "Линейный удар",
  DISCOVERED: "Вскрытое нападение",
  SACRIFICE: "Жертва",
  PROMOTION: "Превращение пешки",
  HANGING_PIECE: "Висячая фигура",
  ENDGAME: "Эндшпиль",
};

const EXPLANATION: Record<PuzzleTheme, string> = {
  MATE_IN_1:
    "Решающий удар в один ход: найдите поле, с которого фигура объявляет мат — королю некуда отступить и нечем закрыться.",
  MATE_IN_2:
    "Форсированный мат в два хода: первый ход вынуждает единственный ответ соперника, второй — ставит мат.",
  MATE_IN_3:
    "Мат в три хода: цепочка форсированных ходов, где каждый ответ соперника вынужден, а финал — неизбежный мат.",
  BACK_RANK:
    "Мат по последней горизонтали: король заперт собственными пешками, и тяжёлая фигура врывается на последний ряд.",
  FORK: "Двойной удар: одна фигура одновременно нападает на две цели, и соперник не успевает защитить обе.",
  PIN: "Связка: фигура соперника не может уйти, не подставив более ценную фигуру позади себя — используйте её неподвижность.",
  SKEWER:
    "Линейный удар («рентген»): нападение на ценную фигуру заставляет её отойти, открывая под бой фигуру за ней.",
  DISCOVERED:
    "Вскрытое нападение: отходя, фигура открывает линию атаки другой фигуры — два удара одним ходом.",
  SACRIFICE:
    "Жертва: отдайте материал, чтобы получить решающую атаку или отыграть больше — точный расчёт важнее «жадности».",
  PROMOTION:
    "Превращение пешки: доведите пешку до последней горизонтали — новый ферзь решает исход партии.",
  HANGING_PIECE:
    "Висячая фигура: у соперника осталась незащищённая фигура — найдите способ её выиграть.",
  ENDGAME:
    "Эндшпильная техника: точный порядок ходов в окончании решает исход партии.",
};

function toDifficulty(rating: number): Difficulty {
  if (rating < 1200) return Difficulty.EASY;
  if (rating < 1700) return Difficulty.MEDIUM;
  return Difficulty.HARD;
}

/** UCI-ход ("e2e4", "e7e8q") → объект для chess.js */
function uciToMove(uci: string) {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}

interface Candidate {
  lichessId: string;
  fen: string;
  solution: string;
  theme: PuzzleTheme;
  difficulty: Difficulty;
  rating: number;
}

/** Разбор одной CSV-строки Lichess; null — если не подходит */
function parseRow(line: string, quotas: Map<string, number>): Candidate | null {
  // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
  const cols = line.split(",");
  if (cols.length < 8) return null;

  const [id, fen, movesStr, ratingStr, devStr, popStr, playsStr, themesStr] = cols;
  const rating = Number(ratingStr);
  if (!Number.isFinite(rating)) return null;

  // Фильтры качества: проверенные, популярные задачи с точным рейтингом
  if (Number(devStr) > 90 || Number(popStr) < 70 || Number(playsStr) < 200) return null;

  // Тема: берём самую приоритетную из наших шести
  const themes = themesStr.split(" ");
  const mapped = THEME_MAP.find(([lichess]) => themes.includes(lichess));
  if (!mapped) return null;
  const theme = mapped[1];
  const difficulty = toDifficulty(rating);

  // Квота этой пары тема×сложность уже заполнена?
  const bucket = `${theme}:${difficulty}`;
  if ((quotas.get(bucket) ?? 0) >= PER_BUCKET) return null;

  // Конвертация: применяем «подводку» соперника, остальное переводим в SAN
  const moves = movesStr.split(" ");
  if (moves.length < 2) return null;
  const chess = new Chess();
  try {
    chess.load(fen);
    chess.move(uciToMove(moves[0])); // ход соперника → стартовая позиция задачи
    const startFen = chess.fen();
    const san: string[] = [];
    for (let i = 1; i < moves.length; i++) {
      san.push(chess.move(uciToMove(moves[i])).san);
    }
    quotas.set(bucket, (quotas.get(bucket) ?? 0) + 1);
    return {
      lichessId: id,
      fen: startFen,
      solution: san.join(" "),
      theme,
      difficulty,
      rating,
    };
  } catch {
    return null; // нелегальная позиция/ход — пропускаем
  }
}

async function main() {
  const totalTarget = PER_BUCKET * THEME_MAP.length * 3;
  console.log(`📥 Импорт задач Lichess: цель ~${totalTarget} (${PER_BUCKET} на тему×сложность)`);
  console.log("   Скачивание и разбор потока (файл целиком НЕ сохраняется)…");

  const existing = new Set(
    (
      await prisma.puzzle.findMany({
        where: { lichessId: { not: null } },
        select: { lichessId: true },
      })
    ).map((p) => p.lichessId!)
  );
  console.log(`   Уже в базе: ${existing.size} импортированных задач`);

  // До 3 попыток: у undici короткий connect-timeout, первое соединение
  // с database.lichess.org иногда не успевает установиться
  let res: Response | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch(URL, { redirect: "follow" });
      if (res.ok) break;
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      console.log(`   ⚠️ Попытка ${attempt}/3 не удалась: ${(e as Error).message}`);
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  if (!res?.ok || !res.body) throw new Error("Не удалось скачать файл задач");

  const quotas = new Map<string, number>();
  const batch: Candidate[] = [];
  let inserted = 0;
  let header = true;
  let tail = ""; // незавершённая строка между чанками
  let done = false;
  let downloadedMB = 0;

  const decoder = new TextDecoder();

  async function flush() {
    if (batch.length === 0) return;
    const data = batch.splice(0, batch.length).map((c, i) => ({
      ...c,
      title: `${TITLE[c.theme]} · №${inserted + i + 1}`,
      description: `${EXPLANATION[c.theme]} Рейтинг Lichess: ${c.rating}.`,
    }));
    const r = await prisma.puzzle.createMany({ data, skipDuplicates: true });
    inserted += r.count;
  }

  // Декомпрессор zstd: скармливаем сжатые чанки, получаем текст CSV
  const pendingLines: string[] = [];
  const dec = new Decompress((chunk) => {
    tail += decoder.decode(chunk, { stream: true });
    const lines = tail.split("\n");
    tail = lines.pop() ?? "";
    pendingLines.push(...lines);
  });

  const reader = res.body.getReader();
  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    downloadedMB += value.byteLength / 1e6;
    dec.push(value);

    // Обрабатываем накопленные строки
    while (pendingLines.length > 0) {
      const line = pendingLines.shift()!;
      if (header) {
        header = false;
        continue;
      }
      if (!line) continue;
      const cand = parseRow(line, quotas);
      if (!cand || existing.has(cand.lichessId)) continue;
      batch.push(cand);
      if (batch.length >= 500) await flush();
    }

    // Все квоты набраны? Останавливаем скачивание
    const filled = [...quotas.values()].reduce((s, v) => s + v, 0);
    if (filled >= totalTarget) done = true;
    if (Math.floor(downloadedMB) % 25 === 0 && downloadedMB > 1) {
      process.stdout.write(
        `\r   ⏬ ${downloadedMB.toFixed(0)} МБ | собрано ${filled}/${totalTarget}`
      );
    }
  }
  await reader.cancel().catch(() => {});
  await flush();

  const total = await prisma.puzzle.count();
  console.log(`\n✅ Импортировано новых: ${inserted}. Всего задач в базе: ${total}`);

  // Сводка по темам
  const byTheme = await prisma.puzzle.groupBy({ by: ["theme"], _count: true });
  for (const t of byTheme) console.log(`   ${t.theme}: ${t._count}`);
}

main()
  .catch((e) => {
    console.error("Ошибка импорта:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
