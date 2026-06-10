const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const { round2 } = require("../utils/number.utils");

const WS_MAGIC_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const clientsBySessionId = new Map();
const adminBinClients = new Set();

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

function addAdminBinClient(socket) {
  adminBinClients.add(socket);

  socket.on("close", () => {
    adminBinClients.delete(socket);
  });

  socket.on("error", () => {
    adminBinClients.delete(socket);
  });
}

function authenticateAdminUpgrade(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    return decoded?.role === "admin";
  } catch {
    return false;
  }
}

function acceptWebSocket(req, socket) {
  const key = req.headers["sec-websocket-key"];
  if (!key) return false;

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

  return true;
}

function formatBinPayload(bin) {
  return {
    id: bin.id,
    name: bin.name,
    material: bin.material,
    max_weight: Number(bin.max_weight ?? 0),
    current_weight: Number(bin.current_weight ?? 0),
    status: bin.status,
    last_seen_at: bin.last_seen_at,
  };
}

function formatLiveWeightPayload(session, bin) {
  const startWeight = Number(session.start_weight ?? 0);
  const currentWeight = Number(bin.current_weight ?? 0);
  const depositedWeight = Math.max(0, round2(currentWeight - startWeight));

  return {
    type: "live_weight",
    session_id: session.id,
    bin_id: session.bin_id,
    start_weight: startWeight,
    current_weight: currentWeight,
    deposited_weight: depositedWeight,
    status: bin.status,
    last_seen_at: bin.last_seen_at,
    is_active: !session.ended_at,
  };
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

  return formatLiveWeightPayload(session, session.bin);
}

async function buildAdminBinsPayload() {
  const bins = await prisma.bin.findMany({
    select: {
      id: true,
      name: true,
      material: true,
      max_weight: true,
      current_weight: true,
      status: true,
      last_seen_at: true,
    },
    orderBy: { id: "desc" },
  });

  return {
    type: "admin_bins",
    data: {
      bins: bins.map(formatBinPayload),
    },
  };
}

async function buildAdminBinPayload(binId) {
  const bin = await prisma.bin.findUnique({
    where: { id: Number(binId) },
    select: {
      id: true,
      name: true,
      material: true,
      max_weight: true,
      current_weight: true,
      status: true,
      last_seen_at: true,
    },
  });

  if (!bin) return null;

  return {
    type: "admin_bin_update",
    data: formatBinPayload(bin),
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

async function broadcastAdminBin(binId) {
  if (adminBinClients.size === 0) return;

  const payload = await buildAdminBinPayload(binId);
  if (!payload) return;

  for (const socket of adminBinClients) {
    writeFrame(socket, payload);
  }
}

async function broadcastBinTelemetryUpdate(binId) {
  await broadcastAdminBin(binId);

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

async function broadcastBinTelemetryResult(result) {
  if (!result?.bin?.id) return;

  if (adminBinClients.size > 0) {
    const payload = {
      type: "admin_bin_update",
      data: formatBinPayload(result.bin),
    };

    for (const socket of adminBinClients) {
      writeFrame(socket, payload);
    }
  }

  const sessions = Array.isArray(result.active_sessions) ? result.active_sessions : [];
  for (const session of sessions) {
    const clients = clientsBySessionId.get(session.id);
    if (!clients || clients.size === 0) continue;

    const payload = formatLiveWeightPayload(session, result.bin);
    for (const socket of clients) {
      writeFrame(socket, payload);
    }
  }
}

function parseSessionIdFromPath(pathname) {
  const match = pathname.match(/^\/api\/v1\/recycling-sessions\/(\d+)\/live-weight\/ws$/);
  if (!match) return null;

  const sessionId = Number(match[1]);
  return Number.isInteger(sessionId) && sessionId > 0 ? sessionId : null;
}

function isAdminBinsPath(pathname) {
  return pathname === "/ws/admin/bins" || pathname === "/api/v1/ws/admin/bins";
}

function attachLiveWeightWebSocket(server) {
  server.on("upgrade", async (req, socket) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (isAdminBinsPath(url.pathname)) {
        if (!authenticateAdminUpgrade(req) || !acceptWebSocket(req, socket)) {
          socket.destroy();
          return;
        }

        addAdminBinClient(socket);

        const initialPayload = await buildAdminBinsPayload();
        writeFrame(socket, initialPayload);
        return;
      }

      const sessionId = parseSessionIdFromPath(url.pathname);

      if (!sessionId || !acceptWebSocket(req, socket)) {
        socket.destroy();
        return;
      }

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
  broadcastBinTelemetryResult,
};
