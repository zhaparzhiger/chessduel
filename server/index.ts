/**
 * Точка входа Chess Duel.
 *
 * Архитектура: один HTTP-сервер на порту 3000, внутри которого:
 *  - Express — базовый каркас (health-check, будущие REST-расширения)
 *  - Next.js — рендерит все страницы и API-роуты (NextAuth и т.д.)
 *  - Socket.io — реал-тайм игра по пути /api/socket
 *
 * Такой сетап даёт общий origin для кук NextAuth и веб-сокетов.
 * Запуск: npm run dev  |  npm run build && npm start
 *
 * ВАЖНО: сначала грузим .env (loadEnvConfig), и только потом — динамически —
 * модули, которым нужны переменные окружения (Prisma, Auth). Иначе Prisma
 * не увидит DATABASE_URL на старте.
 */
import { createServer } from "node:http";
import { loadEnvConfig } from "@next/env";

const dev = process.env.NODE_ENV !== "production";

// 1. Загружаем переменные окружения из .env* ДО импорта Prisma/Next
loadEnvConfig(process.cwd(), dev);

const port = Number(process.env.PORT ?? 3000);

async function main() {
  // 2. Динамические импорты — уже с загруженным env
  const [{ default: express }, { default: next }, { Server }, { registerSocketHandlers }] =
    await Promise.all([
      import("express"),
      import("next"),
      import("socket.io"),
      import("./socket"),
    ]);

  const app = next({ dev });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = express();
  const httpServer = createServer(server);

  // Socket.io поверх того же HTTP-сервера
  const io = new Server(httpServer, { path: "/api/socket" });
  registerSocketHandlers(io);

  // Простой health-check (пример «чистого» Express-роута)
  server.get("/healthz", (_req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  // Всё остальное — Next.js
  server.use((req, res) => handle(req, res));

  httpServer.listen(port, () => {
    console.log(
      `♟️  Chess Duel запущен: http://localhost:${port} (${dev ? "dev" : "prod"})`
    );
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
