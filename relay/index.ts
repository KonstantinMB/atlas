/**
 * YC Hedge Fund Relay Server
 * Express + WebSocket server deployed on Railway.
 *
 * Multiplexes:
 *  - AISStream.io WebSocket → real-time vessel positions
 *  - OpenSky Network REST poll (30 s) → aircraft batches
 *
 * Message format sent to clients:
 *   { type: 'ais' | 'aircraft' | 'ping' | 'error', data: any, timestamp: number }
 *
 * Clients may send:
 *   { type: 'subscribe', channels: ['ais', 'aircraft'] }
 * to limit which message types they receive (default: both).
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { AISStreamClient } from './ais-stream.js';
import { OpenSkyPoller } from './opensky-poll.js';

const PORT = parseInt(process.env.PORT ?? '8080', 10);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// --- Health check ---------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    clients: clients.size,
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

app.get('/', (_req, res) => {
  res.json({ service: 'yc-hedge-fund-relay', version: '1.0.0' });
});

// --- Client registry ------------------------------------------------------

/** Map of connected clients → their subscribed channel set */
const clients = new Map<WebSocket, Set<string>>();

wss.on('connection', (ws: WebSocket) => {
  // Subscribe to all channels by default
  clients.set(ws, new Set(['ais', 'aircraft']));

  // Send welcome ping
  send(ws, 'ping', { serverTime: Date.now() });

  ws.on('message', (rawData: Buffer) => {
    try {
      const msg = JSON.parse(rawData.toString()) as { type?: string; channels?: string[] };
      if (msg.type === 'subscribe' && Array.isArray(msg.channels)) {
        clients.set(ws, new Set(msg.channels));
      }
    } catch {
      // Ignore unparseable messages
    }
  });

  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

// --- Helpers --------------------------------------------------------------

function send(ws: WebSocket, type: string, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));
  }
}

function broadcast(type: string, data: unknown): void {
  const payload = JSON.stringify({ type, data, timestamp: Date.now() });
  for (const [ws, channels] of clients) {
    if (ws.readyState === WebSocket.OPEN && channels.has(type)) {
      ws.send(payload);
    }
  }
}

// --- AIS stream -----------------------------------------------------------

if (process.env.AISSTREAM_API_KEY) {
  const aisClient = new AISStreamClient();
  aisClient.connect();
  aisClient.subscribe((vessel) => broadcast('ais', vessel));
  console.log('[Relay] AIS stream client started');
} else {
  console.warn('[Relay] AISSTREAM_API_KEY not set — AIS stream disabled');
}

// --- OpenSky poller -------------------------------------------------------

const openskPoller = new OpenSkyPoller();
openskPoller.subscribe((aircraft) => broadcast('aircraft', aircraft));

// start() is async — it probes connectivity first and skips polling if blocked
void openskPoller.start(30_000);

// --- Start server ---------------------------------------------------------

server.listen(PORT, () => {
  console.log(`[Relay] WebSocket relay listening on port ${PORT}`);
});

// --- Graceful shutdown ----------------------------------------------------

process.on('SIGTERM', () => {
  console.log('[Relay] SIGTERM received, shutting down…');
  openskPoller.stop();
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[Relay] SIGINT received, shutting down…');
  openskPoller.stop();
  server.close(() => process.exit(0));
});
