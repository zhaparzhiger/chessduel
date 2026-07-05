/**
 * Валидация пользовательской шахматной задачи.
 * Проверяет FEN и проигрывает решение ход за ходом через chess.js.
 * Возвращает нормализованное решение (канонический SAN) или ошибку.
 */
import { Chess } from "chess.js";

export interface ValidatedPuzzle {
  /** Решение в каноническом SAN через пробел */
  solution: string;
  /** Чей ход в стартовой позиции */
  sideToMove: "w" | "b";
}

export function validatePuzzle(
  fen: string,
  solutionRaw: string
): { ok: true; data: ValidatedPuzzle } | { ok: false; error: string } {
  let chess: Chess;
  try {
    chess = new Chess(fen.trim());
  } catch {
    return { ok: false, error: "Некорректный FEN — проверьте позицию" };
  }

  const tokens = solutionRaw
    .trim()
    .split(/\s+/)
    // Отбрасываем номера ходов вида «1.» или «1...», если учитель их вставил
    .filter((t) => !/^\d+\.+$/.test(t))
    .map((t) => t.replace(/^\d+\.+/, ""));

  if (tokens.length === 0) {
    return { ok: false, error: "Укажите хотя бы один ход решения" };
  }
  if (tokens.length % 2 === 0) {
    return {
      ok: false,
      error:
        "Решение должно заканчиваться ходом ученика (нечётное число ходов): ход ученика, ответ соперника, ход ученика…",
    };
  }

  const sideToMove = chess.turn();
  const normalized: string[] = [];
  for (const [i, token] of tokens.entries()) {
    try {
      const mv = chess.move(token);
      normalized.push(mv.san);
    } catch {
      return {
        ok: false,
        error: `Ход №${i + 1} («${token}») нелегален в этой позиции`,
      };
    }
  }

  return {
    ok: true,
    data: { solution: normalized.join(" "), sideToMove },
  };
}
