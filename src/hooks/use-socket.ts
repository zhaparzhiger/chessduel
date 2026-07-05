"use client";

/**
 * useSocket — единое подключение Socket.io на клиенте.
 * Куки сессии отправляются автоматически (тот же origin),
 * поэтому сервер аутентифицирует сокет прозрачно.
 */
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/types/game";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let singleton: GameSocket | null = null;

/** Ленивая инициализация одного сокета на всё приложение */
function getSocket(): GameSocket {
  if (!singleton) {
    singleton = io({
      path: "/api/socket",
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }
  return singleton;
}

export function useSocket() {
  const socketRef = useRef<GameSocket | null>(null);
  const [connected, setConnected] = useState(false);

  if (!socketRef.current) socketRef.current = getSocket();

  useEffect(() => {
    const socket = socketRef.current!;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) setConnected(true);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return { socket: socketRef.current, connected };
}
