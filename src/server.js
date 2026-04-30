// src/server.js

require("dotenv").config();
const app = require("./app");
const { startMqttListener, stopMqttListener } = require("./services/mqtt.service");
const { attachLiveWeightWebSocket } = require("./services/live_weight_ws.service");

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startMqttListener();
});

attachLiveWeightWebSocket(server);

process.on("SIGINT", () => {
  stopMqttListener();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopMqttListener();
  process.exit(0);
});
