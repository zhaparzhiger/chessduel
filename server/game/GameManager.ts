/**
 * GameManager — in-memory состояние всех активных комнат.
 *
 * Ответственность:
 *  - жизненный цикл комнаты: LOBBY → PLAYING → FINISHED
 *  - независимая доска для каждого ученика (все решают одну задачу параллельно)
 *  - проверка ходов через chess.js (сервер — единственный источник правды,
 *    решение задачи никогда не отправляется клиенту заранее)
 *  - подсчёт очков, лидерборд, режимы DUEL / TEAM / BATTLE_ROYALE
 *  - таймер задачи и авто-переход к следующей
 *  - сохранение результатов в PostgreSQL через Prisma
 */
import { Chess } from "chess.js";
import type { Server } from "socket.io";
import { prisma } from "../../src/lib/prisma";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  GameMode,
  LeaderboardEntry,
  MoveResult,
  PlayerInfo,
  PuzzleClientView,
  RoomSnapshot,
  RoomStatus,
} from "../../src/types/game";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

/** Полная задача (с решением) — живёт только на сервере */
interface ServerPuzzle {
  id: string;
  title: string;
  description: string;
  fen: string;
  /** Ходы решения в SAN; чётные — игрок, нечётные — автоответ соперника */
  moves: string[];
  theme: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

/** Прогресс одного игрока по текущей задаче */
interface PlayerPuzzleProgress {
  fen: string;        // текущая позиция на доске игрока
  step: number;       // индекс следующего ожидаемого хода игрока в moves
  solved: boolean;
  failed: boolean;
  attemptsLeft: number;
  solvedAtMs: number | null; // время решения от старта задачи
}

interface PlayerState {
  info: PlayerInfo;
  points: number;
  solved: number;
  progress: PlayerPuzzleProgress | null;
  /** Итог по каждой сыгранной задаче (для истории в результатах) */
  history: ("solved" | "failed" | "missed")[];
}

interface RoomState {
  roomId: string;
  code: string;
  name: string;
  hostId: string;
  mode: GameMode;
  status: RoomStatus;
  secondsPerPuzzle: number;
  puzzles: ServerPuzzle[];
  currentIndex: number;
  deadline: number | null;
  timer: NodeJS.Timeout | null;
  sessionId: string | null;
  players: Map<string, PlayerState>;
  /** userId решивших текущую задачу — в порядке решения */
  solvedOrder: string[];
}

const BASE_POINTS: Record<ServerPuzzle["difficulty"], number> = {
  EASY: 100,
  MEDIUM: 150,
  HARD: 200,
};
const FIRST_SOLVE_BONUS = 25;
const MAX_TIME_BONUS = 50;
const RETRY_PENALTY = 0.3; // −30% за использованную повторную попытку
const ATTEMPTS_PER_PUZZLE = 2;
const SUMMARY_PAUSE_MS = 6000; // пауза между задачами (показ решения)

export class GameManager {
  private rooms = new Map<string, RoomState>();

  constructor(private io: IO) {}

  // ─────────────────────── Комнаты и лобби ───────────────────────

  /** Загружает комнату из БД в память (или возвращает уже активную) */
  async ensureRoom(code: string): Promise<RoomState | null> {
    const existing = this.rooms.get(code);
    if (existing) return existing;

    const room = await prisma.room.findUnique({ where: { code } });
    if (!room || room.status === "FINISHED") return null;

    // Случайная выборка задач на стороне PostgreSQL: в базе могут быть тысячи
    // задач (импорт Lichess), тянуть их все в память незачем.
    const picked = await prisma.$queryRaw<
      {
        id: string;
        title: string;
        description: string;
        fen: string;
        solution: string;
        theme: string;
        difficulty: "EASY" | "MEDIUM" | "HARD";
      }[]
    >`
      SELECT id, title, description, fen, solution, theme::text AS theme, difficulty::text AS difficulty
      FROM puzzles
      WHERE (${room.theme}::text IS NULL OR theme::text = ${room.theme}::text)
        AND (${room.difficulty}::text IS NULL OR difficulty::text = ${room.difficulty}::text)
        AND (${room.customOnly}::boolean = false OR "authorId" = ${room.hostId})
      ORDER BY RANDOM()
      LIMIT ${room.puzzleCount}
    `;
    if (picked.length === 0) return null;

    const state: RoomState = {
      roomId: room.id,
      code: room.code,
      name: room.name,
      hostId: room.hostId,
      mode: room.mode,
      status: "LOBBY",
      secondsPerPuzzle: room.secondsPerPuzzle,
      puzzles: picked.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        fen: p.fen,
        moves: p.solution.split(/\s+/),
        theme: p.theme,
        difficulty: p.difficulty,
      })),
      currentIndex: -1,
      deadline: null,
      timer: null,
      sessionId: null,
      players: new Map(),
      solvedOrder: [],
    };
    this.rooms.set(code, state);
    return state;
  }

  getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code);
  }

  /** Игрок входит в комнату (или переподключается) */
  joinPlayer(
    room: RoomState,
    user: { id: string; name: string; role: "TEACHER" | "STUDENT" }
  ): boolean {
    const existing = room.players.get(user.id);
    if (existing) {
      existing.info.connected = true; // reconnect
      return true;
    }
    // Новые ученики не могут войти в идущую игру (только в лобби)
    if (room.status !== "LOBBY" && user.role === "STUDENT") return false;

    const player: PlayerState = {
      info: {
        userId: user.id,
        name: user.name,
        role: user.role,
        connected: true,
        eliminated: false,
        // Командный режим: чередуем A/B по числу учеников
        team:
          room.mode === "TEAM" && user.role === "STUDENT"
            ? countStudents(room) % 2 === 0
              ? "A"
              : "B"
            : undefined,
      },
      points: 0,
      solved: 0,
      progress: null,
      history: [],
    };
    room.players.set(user.id, player);
    return true;
  }

  markDisconnected(room: RoomState, userId: string) {
    const p = room.players.get(userId);
    if (p) p.info.connected = false;
    // Пустое лобби чистим из памяти
    if (
      room.status === "LOBBY" &&
      [...room.players.values()].every((pl) => !pl.info.connected)
    ) {
      this.rooms.delete(room.code);
    }
  }

  // ─────────────────────── Игровой цикл ───────────────────────

  /** Старт игры (только учитель-хост) */
  async startGame(room: RoomState, byUserId: string): Promise<string | null> {
    if (byUserId !== room.hostId) return "Только создатель комнаты может начать игру";
    if (room.status !== "LOBBY") return "Игра уже началась";
    if (countStudents(room) === 0) return "В комнате нет ни одного ученика";

    const session = await prisma.gameSession.create({
      data: { roomId: room.roomId, puzzleIds: room.puzzles.map((p) => p.id) },
    });
    await prisma.room.update({
      where: { id: room.roomId },
      data: { status: "PLAYING" },
    });

    room.sessionId = session.id;
    room.status = "PLAYING";
    this.nextPuzzle(room);
    return null;
  }

  /** Выдаёт следующую задачу или завершает игру */
  private nextPuzzle(room: RoomState) {
    if (room.timer) clearTimeout(room.timer);
    room.currentIndex++;
    room.solvedOrder = [];

    if (room.currentIndex >= room.puzzles.length) {
      void this.finishGame(room);
      return;
    }

    const puzzle = room.puzzles[room.currentIndex];
    // Свежая доска каждому активному ученику
    for (const p of room.players.values()) {
      p.progress =
        p.info.role === "STUDENT" && !p.info.eliminated
          ? {
              fen: puzzle.fen,
              step: 0,
              solved: false,
              failed: false,
              attemptsLeft: ATTEMPTS_PER_PUZZLE,
              solvedAtMs: null,
            }
          : null;
    }

    room.deadline = Date.now() + room.secondsPerPuzzle * 1000;
    room.timer = setTimeout(
      () => this.endPuzzle(room),
      room.secondsPerPuzzle * 1000
    );

    this.io
      .to(room.code)
      .emit("game:puzzle", toClientPuzzle(puzzle, room), room.deadline);
    this.broadcastLeaderboard(room);
  }

  /** Итог текущей задачи → пауза → следующая */
  private endPuzzle(room: RoomState) {
    // Защита от двойного вызова (таймер + «все закончили» почти одновременно)
    if (room.deadline === null) return;
    room.deadline = null;
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    const puzzle = room.puzzles[room.currentIndex];

    // Записываем итог задачи в историю каждого ученика
    for (const p of room.players.values()) {
      if (p.info.role !== "STUDENT") continue;
      p.history.push(
        p.progress?.solved ? "solved" : p.progress?.failed ? "failed" : "missed"
      );
    }

    // Battle Royale: выбывает худший на этом раунде среди активных
    let eliminatedId: string | null = null;
    if (room.mode === "BATTLE_ROYALE") {
      eliminatedId = this.eliminateWorst(room);
    }

    this.io.to(room.code).emit("game:puzzleSummary", {
      puzzleId: puzzle.id,
      title: puzzle.title,
      solution: puzzle.moves.join(" "),
      explanation: puzzle.description,
      solvedBy: [...room.solvedOrder],
      eliminated: eliminatedId,
    });
    this.broadcastLeaderboard(room);

    // Если после выбывания остался ≤1 активный ученик — заканчиваем
    const active = activeStudents(room);
    const shouldFinish =
      room.mode === "BATTLE_ROYALE" && active.length <= 1;

    room.timer = setTimeout(() => {
      if (shouldFinish) void this.finishGame(room);
      else this.nextPuzzle(room);
    }, SUMMARY_PAUSE_MS);
  }

  /** BATTLE_ROYALE: убирает игрока с минимумом очков (при равенстве — не решившего) */
  private eliminateWorst(room: RoomState): string | null {
    const active = activeStudents(room);
    if (active.length <= 1) return null;
    const worst = [...active].sort((a, b) => {
      // Сначала те, кто не решил текущую задачу, затем по очкам, затем по скорости
      const aSolved = a.progress?.solved ? 1 : 0;
      const bSolved = b.progress?.solved ? 1 : 0;
      if (aSolved !== bSolved) return aSolved - bSolved;
      if (a.points !== b.points) return a.points - b.points;
      return (b.progress?.solvedAtMs ?? Infinity) === (a.progress?.solvedAtMs ?? Infinity)
        ? 0
        : (b.progress?.solvedAtMs ?? Infinity) - (a.progress?.solvedAtMs ?? Infinity);
    })[0];
    worst.info.eliminated = true;
    return worst.info.userId;
  }

  // ─────────────────────── Проверка хода ───────────────────────

  /**
   * Главная функция геймплея: проверяет ход ученика против решения.
   * Принимает ход как {from,to,promotion} (drag&drop) или как SAN-строку.
   */
  async handleMove(
    room: RoomState,
    userId: string,
    move: { from?: string; to?: string; promotion?: string; san?: string }
  ): Promise<MoveResult | { error: string }> {
    if (room.status !== "PLAYING" || room.deadline === null)
      return { error: "Игра не идёт" };
    if (Date.now() > room.deadline) return { error: "Время вышло" };

    const player = room.players.get(userId);
    const progress = player?.progress;
    if (!player || !progress) return { error: "Вы не участвуете в этой задаче" };
    if (progress.solved) return { error: "Задача уже решена" };
    if (progress.failed) return { error: "Попытки закончились" };

    const puzzle = room.puzzles[room.currentIndex];
    const chess = new Chess(progress.fen);

    // 1. Пытаемся применить ход (chess.js бросает исключение на нелегальный)
    let applied;
    try {
      applied = move.san
        ? chess.move(move.san.trim())
        : chess.move({
            from: move.from!,
            to: move.to!,
            promotion: move.promotion ?? "q",
          });
    } catch {
      return { error: "Нелегальный ход" };
    }

    // 2. Сравниваем с ожидаемым ходом решения
    const expectedSan = puzzle.moves[progress.step];
    const isExpected = applied.san === expectedSan;
    // Альтернативный мат тоже засчитываем (у мата в 1 бывает несколько решений)
    const isAltMate =
      !isExpected && expectedSan.endsWith("#") && chess.isCheckmate();

    if (!isExpected && !isAltMate) {
      // Неверно: откатываем доску к началу задачи, минус попытка
      progress.attemptsLeft--;
      progress.fen = puzzle.fen;
      progress.step = 0;

      if (progress.attemptsLeft <= 0) {
        progress.failed = true;
        await this.recordAttempt(room, player, puzzle, false);
        this.broadcastLeaderboard(room);
        this.maybeEndPuzzleEarly(room);
      }
      return {
        correct: false,
        san: applied.san,
        reply: null,
        fen: puzzle.fen,
        solved: false,
        points: 0,
        explanation: progress.failed ? puzzle.description : null,
      };
    }

    // 3. Ход верный: применяем автоответ соперника (если есть)
    let reply: string | null = null;
    const replyMove = puzzle.moves[progress.step + 1];
    if (replyMove !== undefined) {
      chess.move(replyMove);
      reply = replyMove;
    }
    progress.fen = chess.fen();
    progress.step += 2;

    const solved = progress.step >= puzzle.moves.length;
    let points = 0;

    if (solved) {
      progress.solved = true;
      progress.solvedAtMs =
        room.secondsPerPuzzle * 1000 - (room.deadline - Date.now());
      points = this.scoreSolve(room, player, puzzle);
      player.points += points;
      player.solved++;
      room.solvedOrder.push(userId);
      await this.recordAttempt(room, player, puzzle, true, points);
      this.broadcastLeaderboard(room);
      this.maybeEndPuzzleEarly(room);
    }

    return {
      correct: true,
      san: applied.san,
      reply,
      fen: progress.fen,
      solved,
      points,
      explanation: solved ? puzzle.description : null,
    };
  }

  /** Очки: база за сложность + бонус за скорость + бонус первому − штраф за retry */
  private scoreSolve(
    room: RoomState,
    player: PlayerState,
    puzzle: ServerPuzzle
  ): number {
    const base = BASE_POINTS[puzzle.difficulty];
    const remaining = Math.max(0, (room.deadline ?? 0) - Date.now());
    const timeBonus = Math.round(
      (remaining / (room.secondsPerPuzzle * 1000)) * MAX_TIME_BONUS
    );
    const firstBonus = room.solvedOrder.length === 0 ? FIRST_SOLVE_BONUS : 0;
    const retriesUsed =
      ATTEMPTS_PER_PUZZLE - (player.progress?.attemptsLeft ?? ATTEMPTS_PER_PUZZLE);
    const penalty = 1 - RETRY_PENALTY * retriesUsed;
    return Math.max(10, Math.round((base + timeBonus + firstBonus) * penalty));
  }

  /** Все активные ученики закончили (решили/провалили) → не ждём таймер */
  private maybeEndPuzzleEarly(room: RoomState) {
    if (room.deadline === null) return; // задача уже завершена
    const active = activeStudents(room);
    const allDone =
      active.length > 0 &&
      active.every((p) => p.progress?.solved || p.progress?.failed);
    if (allDone) this.endPuzzle(room);
  }

  // ─────────────────────── Завершение и персистентность ───────────────────────

  private async recordAttempt(
    room: RoomState,
    player: PlayerState,
    puzzle: ServerPuzzle,
    correct: boolean,
    points = 0
  ) {
    if (!room.sessionId) return;
    const timeMs =
      room.secondsPerPuzzle * 1000 - Math.max(0, (room.deadline ?? 0) - Date.now());
    try {
      await prisma.attempt.create({
        data: {
          userId: player.info.userId,
          puzzleId: puzzle.id,
          sessionId: room.sessionId,
          correct,
          timeMs,
          points,
        },
      });
    } catch (e) {
      console.error("[GameManager] failed to record attempt:", e);
    }
  }

  private async finishGame(room: RoomState) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    room.status = "FINISHED";
    room.deadline = null;

    const leaderboard = buildLeaderboard(room);

    // Победитель командного режима
    let winningTeam: "A" | "B" | "DRAW" | null = null;
    if (room.mode === "TEAM") {
      const a = sumTeam(leaderboard, "A");
      const b = sumTeam(leaderboard, "B");
      winningTeam = a === b ? "DRAW" : a > b ? "A" : "B";
    }

    // Сохраняем итоги в БД
    if (room.sessionId) {
      try {
        await prisma.$transaction([
          prisma.gameSession.update({
            where: { id: room.sessionId },
            data: { endedAt: new Date() },
          }),
          prisma.room.update({
            where: { id: room.roomId },
            data: { status: "FINISHED" },
          }),
          ...leaderboard.map((entry, i) =>
            prisma.playerResult.create({
              data: {
                userId: entry.userId,
                sessionId: room.sessionId!,
                points: entry.points,
                solved: entry.solved,
                place: i + 1,
                team: entry.team ?? null,
              },
            })
          ),
        ]);
      } catch (e) {
        console.error("[GameManager] failed to persist results:", e);
      }
    }

    // История по задачам для экрана результатов
    const history: Record<string, ("solved" | "failed" | "missed")[]> = {};
    for (const p of room.players.values()) {
      if (p.info.role === "STUDENT") history[p.info.userId] = p.history;
    }

    this.io.to(room.code).emit("game:over", {
      sessionId: room.sessionId ?? "",
      leaderboard,
      winningTeam,
      history,
      puzzleTitles: room.puzzles.map((p) => p.title),
    });
    this.rooms.delete(room.code);
  }

  // ─────────────────────── Снапшоты для клиента ───────────────────────

  snapshot(room: RoomState): RoomSnapshot {
    const puzzle =
      room.status === "PLAYING" && room.currentIndex >= 0
        ? room.puzzles[room.currentIndex]
        : null;
    return {
      code: room.code,
      name: room.name,
      status: room.status,
      mode: room.mode,
      hostId: room.hostId,
      players: [...room.players.values()].map((p) => p.info),
      secondsPerPuzzle: room.secondsPerPuzzle,
      puzzleCount: room.puzzles.length,
      puzzle: puzzle ? toClientPuzzle(puzzle, room) : null,
      deadline: room.deadline,
      leaderboard: buildLeaderboard(room),
    };
  }

  broadcastState(room: RoomState) {
    this.io.to(room.code).emit("room:state", this.snapshot(room));
  }

  private broadcastLeaderboard(room: RoomState) {
    this.io.to(room.code).emit("game:leaderboard", buildLeaderboard(room));
  }
}

// ─────────────────────── Хелперы ───────────────────────

function toClientPuzzle(puzzle: ServerPuzzle, room: RoomState): PuzzleClientView {
  return {
    id: puzzle.id,
    title: puzzle.title,
    fen: puzzle.fen,
    theme: puzzle.theme as PuzzleClientView["theme"],
    difficulty: puzzle.difficulty,
    sideToMove: puzzle.fen.split(" ")[1] === "b" ? "b" : "w",
    index: room.currentIndex,
    total: room.puzzles.length,
  };
}

function buildLeaderboard(room: RoomState): LeaderboardEntry[] {
  return [...room.players.values()]
    .filter((p) => p.info.role === "STUDENT")
    .map((p) => ({
      userId: p.info.userId,
      name: p.info.name,
      points: p.points,
      solved: p.solved,
      team: p.info.team,
      eliminated: p.info.eliminated,
      solvedCurrent: p.progress?.solved ?? false,
      failedCurrent: p.progress?.failed ?? false,
    }))
    .sort((a, b) => b.points - a.points || b.solved - a.solved);
}

function countStudents(room: RoomState): number {
  return [...room.players.values()].filter((p) => p.info.role === "STUDENT").length;
}

function activeStudents(room: RoomState): PlayerState[] {
  return [...room.players.values()].filter(
    (p) => p.info.role === "STUDENT" && !p.info.eliminated
  );
}

function sumTeam(lb: LeaderboardEntry[], team: "A" | "B"): number {
  return lb.filter((e) => e.team === team).reduce((s, e) => s + e.points, 0);
}
