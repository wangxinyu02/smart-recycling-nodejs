const crypto = require("crypto");
const prisma = require("../config/prisma");
const { round2 } = require("../utils/number.utils");

const WS_MAGIC_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const clientsBySessionId = new Map();

function writeFrame(socket, payload) {
  if (socket.destroyed) return;

  const body = Buffer.from(JSON.stringify(payload));
  const length = body.length;
  let header;

  if (length < 126) {
    header = Buffer.from([0x81, length]);
  } else if (length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  socket.write(Buffer.concat([header, body]));
}

function sendClose(socket) {
  if (!socket.destroyed) {
    socket.end(Buffer.from([0x88, 0x00]));
  }
}

function addClient(sessionId, socket) {
  if (!clientsBySessionId.has(sessionId)) {
    clientsBySessionId.set(sessionId, new Set());
  }

  const clients = clientsBySessionId.get(sessionId);
  clients.add(socket);

  socket.on("close", () => {
    clients.delete(socket);
    if (clients.size === 0) {
      clientsBySessionId.delete(sessionId);
    }
  });

  socket.on("error", () => {
    clients.delete(socket);
    if (clients.size === 0) {
      clientsBySessionId.delete(sessionId);
    }
  });
}

async function buildLiveWeightPayload(sessionId) {
  const session = await prisma.recyclingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      bin_id: true,
      start_weight: true,
      ended_at: true,
      bin: {
        select: {
          current_weight: true,
          status: true,
          last_seen_at: true,
        },
      },
    },
  });

  if (!session || !session.bin_id || !session.bin) return null;

  const startWeight = Number(session.start_weight ?? 0);
  const currentWeight = Number(session.bin.current_weight ?? 0);
  const depositedWeight = Math.max(0, round2(currentWeight - startWeight));

  return {
    type: "live_weight",
    session_id: session.id,
    bin_id: session.bin_id,
    start_weight: startWeight,
    current_weight: currentWeight,
    deposited_weight: depositedWeight,
    status: session.bin.status,
    last_seen_at: session.bin.last_seen_at,
    is_active: !session.ended_at,
  };
}

async function broadcastSession(sessionId) {
  const clients = clientsBySessionId.get(sessionId);
  if (!clients || clients.size === 0) return;

  const payload = await buildLiveWeightPayload(sessionId);
  if (!payload) return;

  for (const socket of clients) {
    writeFrame(socket, payload);
  }
}

async function broadcastBinTelemetryUpdate(binId) {
  const sessions = await prisma.recyclingSession.findMany({
    where: {
      bin_id: Number(binId),
      ended_at: null,
    },
    select: {
      id: true,
    },
  });

  await Promise.all(sessions.map((session) => broadcastSession(session.id)));
}

function parseSessionIdFromPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/recycling-sessions\/(\d+)\/live-weight\/ws$/);
  if (!match) return null;

  const sessionId = Number(match[1]);
  return Number.isInteger(sessionId) && sessionId > 0 ? sessionId : null;
}

function attachLiveWeightWebSocket(server) {
  server.on("upgrade", async (req, socket) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const sessionId = parseSessionIdFromPath(url.pathname);
      const key = req.headers["sec-websocket-key"];

      if (!sessionId || !key) {
        socket.destroy();
        return;
      }

      const accept = crypto
        .createHash("sha1")
        .update(key + WS_MAGIC_GUID)
        .digest("base64");

      socket.write(
        [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${accept}`,
          "\r\n",
        ].join("\r\n"),
      );

      addClient(sessionId, socket);

      const initialPayload = await buildLiveWeightPayload(sessionId);
      if (initialPayload) {
        writeFrame(socket, initialPayload);
      } else {
        sendClose(socket);
      }
    } catch (err) {
      console.error("[WS] Upgrade failed:", err.message);
      socket.destroy();
    }
  });
}

module.exports = {
  attachLiveWeightWebSocket,
  broadcastBinTelemetryUpdate,
};
