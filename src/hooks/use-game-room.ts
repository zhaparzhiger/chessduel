"use client";

/**
 * useGameRoom — вся клиентская логика игровой комнаты в одном месте.
 *
 * Подписывается на события сервера, хранит снапшот комнаты, текущую задачу,
 * лидерборд, чат и последний результат хода. Отдаёт действия (start/move/chat).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "./use-socket";
import type {
  ChatMessage,
  GameOverPayload,
  LeaderboardEntry,
  MoveResult,
  PuzzleClientView,
  PuzzleSummary,
  RoomSnapshot,
} from "@/types/game";

type JoinState = "connecting" | "joined" | "error";

export function useGameRoom(code: string) {
  const { socket, connected } = useSocket();

  const [joinState, setJoinState] = useState<JoinState>("connecting");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [puzzle, setPuzzle] = useState<PuzzleClientView | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [summary, setSummary] = useState<PuzzleSummary | null>(null);
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastMoveResult, setLastMoveResult] = useState<MoveResult | null>(null);

  // Чтобы не переприсоединяться при каждом ре-рендере
  const joinedRef = useRef(false);

  // ─────────── Присоединение к комнате ───────────
  useEffect(() => {
    if (!connected || joinedRef.current) return;
    joinedRef.current = true;

    socket.emit("room:join", code, (ok, error) => {
      if (ok) {
        setJoinState("joined");
      } else {
        setJoinState("error");
        setJoinError(error ?? "Не удалось войти в комнату");
      }
    });
  }, [connected, code, socket]);

  // ─────────── Подписки на события сервера ───────────
  useEffect(() => {
    function onState(s: RoomSnapshot) {
      setSnapshot(s);
      setLeaderboard(s.leaderboard);
      if (s.puzzle) setPuzzle(s.puzzle);
      if (s.deadline) setDeadline(s.deadline);
    }
    function onPuzzle(p: PuzzleClientView, dl: number) {
      setPuzzle(p);
      setDeadline(dl);
      setSummary(null); // прячем итог предыдущей задачи
      setLastMoveResult(null);
    }
    function onLeaderboard(lb: LeaderboardEntry[]) {
      setLeaderboard(lb);
    }
    function onMoveResult(r: MoveResult) {
      setLastMoveResult(r);
    }
    function onSummary(s: PuzzleSummary) {
      setSummary(s);
    }
    function onOver(payload: GameOverPayload) {
      setGameOver(payload);
      setLeaderboard(payload.leaderboard);
    }
    function onChat(m: ChatMessage) {
      setMessages((prev) => [...prev.slice(-49), m]);
    }
    function onError(msg: string) {
      setJoinError(msg);
    }

    socket.on("room:state", onState);
    socket.on("game:puzzle", onPuzzle);
    socket.on("game:leaderboard", onLeaderboard);
    socket.on("game:moveResult", onMoveResult);
    socket.on("game:puzzleSummary", onSummary);
    socket.on("game:over", onOver);
    socket.on("chat:message", onChat);
    socket.on("room:error", onError);

    return () => {
      socket.off("room:state", onState);
      socket.off("game:puzzle", onPuzzle);
      socket.off("game:leaderboard", onLeaderboard);
      socket.off("game:moveResult", onMoveResult);
      socket.off("game:puzzleSummary", onSummary);
      socket.off("game:over", onOver);
      socket.off("chat:message", onChat);
      socket.off("room:error", onError);
    };
  }, [socket]);

  // Покидаем комнату при размонтировании
  useEffect(() => {
    return () => {
      socket.emit("room:leave");
      joinedRef.current = false;
    };
  }, [socket]);

  // ─────────── Действия ───────────
  const startGame = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        socket.emit("game:start", (ok, error) => resolve(ok ? null : error ?? "Ошибка"));
      }),
    [socket]
  );

  const sendMove = useCallback(
    (move: { from?: string; to?: string; promotion?: string; san?: string }) =>
      new Promise<MoveResult | { error: string }>((resolve) => {
        socket.emit("game:move", move, (result) => resolve(result));
      }),
    [socket]
  );

  const sendChat = useCallback(
    (text: string) => socket.emit("chat:send", text),
    [socket]
  );

  return {
    connected,
    joinState,
    joinError,
    snapshot,
    puzzle,
    deadline,
    leaderboard,
    summary,
    gameOver,
    messages,
    lastMoveResult,
    startGame,
    sendMove,
    sendChat,
  };
}
