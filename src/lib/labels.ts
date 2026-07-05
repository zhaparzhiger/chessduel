/** Человекочитаемые подписи для enum-значений (единый источник для UI). */
import type { Difficulty, GameMode, PuzzleTheme, RoomStatus } from "@/types/game";

export const MODE_LABELS: Record<GameMode, string> = {
  DUEL: "Дуэль",
  TEAM: "Командный бой",
  BATTLE_ROYALE: "Королевская битва",
};

export const MODE_HINTS: Record<GameMode, string> = {
  DUEL: "Каждый сам за себя, побеждает набравший больше очков",
  TEAM: "Две команды (A и B) складывают очки участников",
  BATTLE_ROYALE: "После каждой задачи выбывает худший игрок",
};

export const THEME_LABELS: Record<PuzzleTheme, string> = {
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

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "Лёгкая",
  MEDIUM: "Средняя",
  HARD: "Сложная",
};

export const STATUS_LABELS: Record<RoomStatus, string> = {
  LOBBY: "Лобби",
  PLAYING: "Идёт игра",
  FINISHED: "Завершена",
};
