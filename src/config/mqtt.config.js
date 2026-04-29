const MQTT_HOST = process.env.MQTT_HOST || "192.168.0.105";
const MQTT_PORT = process.env.MQTT_PORT || "1883";
const MQTT_PROTOCOL = process.env.MQTT_PROTOCOL || "mqtt";
const MQTT_URL = process.env.MQTT_URL || `${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}`;
const MQTT_TELEMETRY_TOPIC = process.env.MQTT_TELEMETRY_TOPIC || "smart-recycling/bin/telemetry";

module.exports = {
  MQTT_URL,
  MQTT_TELEMETRY_TOPIC,
};
