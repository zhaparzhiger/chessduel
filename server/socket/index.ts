/**
 * Регистрация всех Socket.io-обработчиков.
 * Каждый сокет после room:join состоит в socket.io-комнате с кодом игровой комнаты —
 * широковещание идёт через io.to(code).
 */
import type { Server, Socket } from "socket.io";
import { GameManager } from "../game/GameManager";
import { authenticateSocket, type SocketUser } from "./auth";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../src/types/game";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: { user: SocketUser; roomCode?: string };
};

export function registerSocketHandlers(io: IO) {
  const manager = new GameManager(io);

  // Middleware: пускаем только авторизованных
  io.use(async (socket, next) => {
    const user = await authenticateSocket(socket);
    if (!user) return next(new Error("UNAUTHORIZED"));
    (socket as GameSocket).data.user = user;
    next();
  });

  io.on("connection", (rawSocket) => {
    const socket = rawSocket as GameSocket;
    const user = socket.data.user;

    // ─────────── Вход в комнату ───────────
    socket.on("room:join", async (code, ack) => {
      try {
        const room = await manager.ensureRoom(code.trim().toUpperCase());
        if (!room) return ack(false, "Комната не найдена или уже завершена");

        const joined = manager.joinPlayer(room, user);
        if (!joined) return ack(false, "Игра уже началась — вход закрыт");

        socket.data.roomCode = room.code;
        await socket.join(room.code);
        ack(true);
        manager.broadcastState(room); // все видят нового участника
      } catch (e) {
        console.error("[socket] room:join error:", e);
        ack(false, "Ошибка сервера");
      }
    });

    socket.on("room:leave", () => leaveCurrentRoom(socket));

    // ─────────── Старт игры (учитель) ───────────
    socket.on("game:start", async (ack) => {
      const room = socket.data.roomCode
        ? manager.getRoom(socket.data.roomCode)
        : undefined;
      if (!room) return ack(false, "Вы не в комнате");
      const error = await manager.startGame(room, user.id);
      if (error) return ack(false, error);
      ack(true);
      manager.broadcastState(room);
    });

    // ─────────── Ход ученика ───────────
    socket.on("game:move", async (move, ack) => {
      const room = socket.data.roomCode
        ? manager.getRoom(socket.data.roomCode)
        : undefined;
      if (!room) return ack({ error: "Вы не в комнате" });
      const result = await manager.handleMove(room, user.id, move);
      ack(result);
      // Персональный результат дублируем событием (для анимаций)
      if (!("error" in result)) socket.emit("game:moveResult", result);
    });

    // ─────────── Чат ───────────
    socket.on("chat:send", (text) => {
      const code = socket.data.roomCode;
      const clean = text.trim().slice(0, 300);
      if (!code || !clean) return;
      io.to(code).emit("chat:message", {
        userId: user.id,
        name: user.name,
        text: clean,
        at: Date.now(),
      });
    });

    socket.on("disconnect", () => leaveCurrentRoom(socket));

    function leaveCurrentRoom(s: GameSocket) {
      const code = s.data.roomCode;
      if (!code) return;
      const room = manager.getRoom(code);
      s.data.roomCode = undefined;
      void s.leave(code);
      if (room) {
        manager.markDisconnected(room, user.id);
        if (manager.getRoom(code)) manager.broadcastState(room);
      }
    }
  });
}
