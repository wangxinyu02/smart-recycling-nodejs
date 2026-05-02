# Smart Recycling Node.js Backend

Node.js backend for the Smart Recycling system. It provides REST APIs, MySQL persistence through Prisma, MQTT telemetry ingestion from ESP32 devices, live weight WebSocket updates, reward and points logic, QR-based session claiming, and Firebase push notifications.

## Main Responsibilities

- User and admin authentication with JWT.
- OTP email flow for signup and password reset.
- Admin management for bins, devices, merchants, rewards, users, and notifications.
- Device assignment using `devices` and `bin_device_maps`.
- Recycling session start, live weight, end, signed QR claim, points, and CO2 tracking.
- MQTT telemetry flow:
  - ESP32 publishes telemetry to `smart-recycling/bin/telemetry`.
  - Payload uses `mac_address`.
  - Backend resolves `mac_address -> Device -> active BinDeviceMap -> Bin`.
  - Backend updates bin weight, bin status, bin logs, alerts, notifications, and WebSocket clients.
- MQTT command flow:
  - Bin app starts/ends sessions with `bin_id`.
  - Backend resolves `bin_id -> active device -> mac_address`.
  - Backend publishes commands to `smart-recycling/device/{mac_address}/command`.

## Tech Stack

- Node.js
- Express
- Prisma ORM
- MySQL
- MQTT
- WebSocket upgrade handling
- Firebase Admin SDK
- Nodemailer

## Project Structure

```text
smart-recycling-nodejs/
|-- prisma/
|   |-- migrations/
|   `-- schema.prisma
|-- src/
|   |-- config/
|   |-- controllers/
|   |-- middlewares/
|   |-- models/
|   |-- routes/
|   |-- services/
|   |-- utils/
|   |-- app.js
|   `-- server.js
|-- package.json
`-- prisma.config.ts
```

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Then update the values in `.env` based on your local setup.
Do not commit the real `.env` file.

## Setup

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm start
```

The API runs on `http://localhost:3000` by default.

Health check:

```bash
curl http://localhost:3000/
```

Expected response:

```text
Recycling API is running
```

## API Base Path

All application APIs are mounted under:

```text
/api/v1
```

Main route groups:

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/otp/send`
- `POST /auth/otp/verify`
- `GET /users`
- `GET /home/admin`
- `GET /users/:id/home`
- `GET /bins`
- `POST /bins`
- `PATCH /bins/:id`
- `DELETE /bins/:id`
- `GET /devices`
- `POST /devices`
- `PATCH /devices/:id`
- `DELETE /devices/:id`
- `POST /recycling-sessions/start`
- `GET /recycling-sessions/:id/live-weight`
- `POST /recycling-sessions/:id/end`
- `POST /recycling-sessions/claim`
- `GET /rewards`
- `POST /rewards/:id/redeem`
- `GET /notifications`

Protected routes require:

```http
Authorization: Bearer <jwt-token>
```

## WebSocket Endpoints

Live session weight:

```text
ws://localhost:3000/api/v1/recycling-sessions/{session_id}/live-weight/ws
```

Admin bin dashboard updates:

```text
ws://localhost:3000/api/v1/ws/admin/bins
```

## MQTT Topics

Telemetry from ESP32:

```text
smart-recycling/bin/telemetry
```

Example telemetry payload:

```json
{
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "current_weight": 1.25
}
```

Command to ESP32:

```text
smart-recycling/device/{mac_address}/command
```

Example command payload:

```json
{
  "command": "start_session",
  "bin_id": 1,
  "device_id": 1,
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "session_id": 123,
  "sent_at": "2026-05-02T13:00:00.000Z"
}
```

Optional ESP32 acknowledgement:

```text
smart-recycling/device/{mac_address}/command-ack
```

## Session Flow

1. Bin interface app calls `POST /api/v1/recycling-sessions/start` with `bin_id`.
2. Backend creates a recycling session and publishes `start_session` to the assigned ESP32 device topic.
3. ESP32 tracks local session state and publishes telemetry using `mac_address`.
4. Backend updates the bin weight and broadcasts live weight over WebSocket.
5. Bin interface app calls `POST /api/v1/recycling-sessions/{id}/end`.
6. Backend calculates deposited weight from stored bin weight, creates recycling items, generates a signed QR payload, and publishes `end_session`.
7. User mobile app scans the QR and calls `POST /api/v1/recycling-sessions/claim`.
8. Backend verifies the signed QR payload, attaches the session to the user, and awards points.

## Important Design Notes

- ESP32 telemetry uses `mac_address`, not `bin_id`.
- Backend owns the bin-device mapping.
- QR claim flow uses signed session payloads, not raw `mac_address`.
- `devices.mac_address` is not globally unique at database level, but active devices are validated to prevent duplicate active MAC addresses.
- Deleted devices and bins use soft delete where applicable.

## Useful Commands

```bash
npx prisma studio
npx prisma migrate status
npx prisma migrate dev
npx prisma generate
npm start
```
