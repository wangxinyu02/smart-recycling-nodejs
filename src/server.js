// src/server.js

require("dotenv").config();
const app = require("./app");
const { startMqttListener, stopMqttListener } = require("./services/mqtt.service");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startMqttListener();
});

process.on("SIGINT", () => {
  stopMqttListener();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopMqttListener();
  process.exit(0);
});
