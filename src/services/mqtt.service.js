const mqtt = require("mqtt");
const { MQTT_COMMAND_TOPIC_PREFIX, MQTT_TELEMETRY_TOPIC, MQTT_URL } = require("../config/mqtt.config");
const { recordBinTelemetry } = require("./bin_telemetry.service");
const { broadcastBinTelemetryUpdate } = require("./live_weight_ws.service");

let client;

function parsePayload(message) {
  const text = message.toString();

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function handleTelemetryMessage(topic, message) {
  const payload = parsePayload(message);

  if (topic !== MQTT_TELEMETRY_TOPIC) {
    return;
  }

  console.log("[MQTT] Telemetry received:", {
    topic,
    payload,
    received_at: new Date().toISOString(),
  });

  try {
    const result = await recordBinTelemetry(payload);
    console.log("[MQTT] Telemetry stored:", {
      device_id: result.device?.id ?? null,
      mac_address: result.device?.mac_address ?? null,
      device_created: result.device_created,
      bin_id: result.bin.id,
      log_id: result.log?.id ?? null,
      log_inserted: result.log_inserted,
      log_reason: result.log_reason,
      current_weight: result.bin.current_weight,
      status: result.bin.status,
      last_seen_at: result.bin.last_seen_at,
      alert_notifications_created: result.alert_notifications_created,
      alert_push_result: result.alert_push_result,
    });
    await broadcastBinTelemetryUpdate(result.bin.id);
  } catch (err) {
    console.error("[MQTT] Failed to store telemetry:", err.message);
  }
}

function startMqttListener() {
  if (client) return client;

  client = mqtt.connect(MQTT_URL, {
    clientId: `smart-recycling-backend-${Math.random().toString(16).slice(2)}`,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 5000,
  });

  client.on("connect", () => {
    console.log(`[MQTT] Connected to ${MQTT_URL}`);

    client.subscribe(MQTT_TELEMETRY_TOPIC, { qos: 0 }, (err) => {
      if (err) {
        console.error(`[MQTT] Failed to subscribe to ${MQTT_TELEMETRY_TOPIC}:`, err.message);
        return;
      }

      console.log(`[MQTT] Subscribed to ${MQTT_TELEMETRY_TOPIC}`);
    });
  });

  client.on("message", handleTelemetryMessage);

  client.on("reconnect", () => {
    console.log("[MQTT] Reconnecting...");
  });

  client.on("error", (err) => {
    console.error("[MQTT] Error:", err.message);
  });

  client.on("close", () => {
    console.log("[MQTT] Connection closed");
  });

  return client;
}

function stopMqttListener() {
  if (!client) return;

  client.end(true);
  client = undefined;
}

function publishBinCommand(binId, command, payload = {}) {
  if (!client || !client.connected) {
    console.warn("[MQTT] Command skipped because MQTT is not connected:", { binId, command });
    return false;
  }

  const topic = `${MQTT_COMMAND_TOPIC_PREFIX}/${Number(binId)}/command`;
  const message = JSON.stringify({
    command,
    bin_id: Number(binId),
    ...payload,
    sent_at: new Date().toISOString(),
  });

  client.publish(topic, message, { qos: 0 });
  console.log("[MQTT] Command published:", { topic, message });
  return true;
}

module.exports = {
  startMqttListener,
  stopMqttListener,
  publishBinCommand,
};
