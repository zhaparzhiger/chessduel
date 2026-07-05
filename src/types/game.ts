/**
 * Общие типы игрового протокола.
 * Используются и сервером (server/), и клиентом (src/) —
 * единый источник правды для событий Socket.io.
 */

export type GameMode = "DUEL" | "TEAM" | "BATTLE_ROYALE";
export type RoomStatus = "LOBBY" | "PLAYING" | "FINISHED";
export type PuzzleTheme =
  | "MATE_IN_1"
  | "MATE_IN_2"
  | "MATE_IN_3"
  | "BACK_RANK"
  | "FORK"
  | "PIN"
  | "SKEWER"
  | "DISCOVERED"
  | "SACRIFICE"
  | "PROMOTION"
  | "HANGING_PIECE"
  | "ENDGAME";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";

/** Игрок в комнате (публичная информация) */
export interface PlayerInfo {
  userId: string;
  name: string;
  role: "TEACHER" | "STUDENT";
  team?: "A" | "B";
  connected: boolean;
  /** Выбыл в режиме «королевская битва» */
  eliminated: boolean;
}

/** Строка лидерборда */
export interface LeaderboardEntry {
  userId: string;
  name: string;
  points: number;
  solved: number;
  team?: "A" | "B";
  eliminated: boolean;
  /** Решил ли текущую задачу (для живой индикации) */
  solvedCurrent: boolean;
  failedCurrent: boolean;
}

/** Задача, отправляемая клиенту (без решения!) */
export interface PuzzleClientView {
  id: string;
  title: string;
  fen: string;
  theme: PuzzleTheme;
  difficulty: Difficulty;
  /** Чей ход — вычисляется из FEN, дублируем для удобства UI */
  sideToMove: "w" | "b";
  index: number; // номер задачи в сессии (с 0)
  total: number; // всего задач
}

/** Снимок состояния комнаты для синхронизации клиента */
export interface RoomSnapshot {
  code: string;
  name: string;
  status: RoomStatus;
  mode: GameMode;
  hostId: string;
  players: PlayerInfo[];
  secondsPerPuzzle: number;
  puzzleCount: number;
  /** Текущая задача, если игра идёт */
  puzzle: PuzzleClientView | null;
  /** Unix-время (мс), когда истекает таймер текущей задачи */
  deadline: number | null;
  leaderboard: LeaderboardEntry[];
}

/** Результат проверки хода */
export interface MoveResult {
  correct: boolean;
  /** SAN хода игрока (нормализованный) */
  san: string;
  /** Автоответ соперника, если есть и ход верный */
  reply: string | null;
  /** Новая позиция после хода (и автоответа) */
  fen: string;
  /** Задача решена полностью */
  solved: boolean;
  /** Очки за решение (если solved) */
  points: number;
  /** Объяснение (приходит при solved или при провале задачи) */
  explanation: string | null;
}

export interface ChatMessage {
  userId: string;
  name: string;
  text: string;
  at: number;
}

/** Итог задачи (рассылается всем при переходе к следующей) */
export interface PuzzleSummary {
  puzzleId: string;
  title: string;
  solution: string;
  explanation: string;
  /** userId решивших, в порядке решения */
  solvedBy: string[];
  /** Выбывший в battle royale (если есть) */
  eliminated: string | null;
}

/** Итог игрока по одной задаче (для истории в результатах) */
export type PuzzleOutcome = "solved" | "failed" | "missed";

export interface GameOverPayload {
  sessionId: string;
  leaderboard: LeaderboardEntry[];
  /** Победившая команда в TEAM-режиме */
  winningTeam: "A" | "B" | "DRAW" | null;
  /** История по задачам: userId → результат каждой задачи по порядку */
  history: Record<string, PuzzleOutcome[]>;
  /** Названия задач по порядку (для подписей в истории) */
  puzzleTitles: string[];
}

// ─────────── События: сервер → клиент ───────────
export interface ServerToClientEvents {
  "room:state": (snapshot: RoomSnapshot) => void;
  "room:error": (message: string) => void;
  "game:puzzle": (puzzle: PuzzleClientView, deadline: number) => void;
  "game:leaderboard": (leaderboard: LeaderboardEntry[]) => void;
  /** Персональный результат хода отправившего */
  "game:moveResult": (result: MoveResult) => void;
  "game:puzzleSummary": (summary: PuzzleSummary) => void;
  "game:over": (payload: GameOverPayload) => void;
  "chat:message": (msg: ChatMessage) => void;
}

// ─────────── События: клиент → сервер ───────────
export interface ClientToServerEvents {
  "room:join": (code: string, ack: (ok: boolean, error?: string) => void) => void;
  "room:leave": () => void;
  /** Только учитель */
  "game:start": (ack: (ok: boolean, error?: string) => void) => void;
  /** Ход игрока: from/to/promotion (drag&drop) ЛИБО san (ввод с клавиатуры) */
  "game:move": (
    move: { from?: string; to?: string; promotion?: string; san?: string },
    ack: (result: MoveResult | { error: string }) => void
  ) => void;
  "chat:send": (text: string) => void;
}
