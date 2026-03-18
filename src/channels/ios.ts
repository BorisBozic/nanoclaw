import http from 'http';

import { ASSISTANT_NAME } from '../config.js';
import { readEnvFile } from '../env.js';
import { logger } from '../logger.js';
import { registerChannel, ChannelOpts } from './registry.js';
import {
  Channel,
  OnChatMetadata,
  OnInboundMessage,
  RegisteredGroup,
} from '../types.js';

// Use dynamic import for ws since it's an ESM/CJS package
let WebSocketServer: any;

const DEFAULT_PORT = 3100;

export interface IosChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
}

interface ConnectedClient {
  ws: any; // WebSocket instance
  deviceId: string;
  jid: string;
}

export class IosChannel implements Channel {
  name = 'ios';

  private server: http.Server | null = null;
  private wss: any = null; // WebSocketServer
  private clients = new Map<string, ConnectedClient>();
  private port: number;
  private token: string;
  private opts: IosChannelOpts;

  constructor(port: number, token: string, opts: IosChannelOpts) {
    this.port = port;
    this.token = token;
    this.opts = opts;
  }

  async connect(): Promise<void> {
    // Dynamically import ws
    const wsModule = await import('ws');
    WebSocketServer = wsModule.WebSocketServer;

    this.server = http.createServer((req, res) => {
      this.handleHttp(req, res);
    });

    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws: any, req: http.IncomingMessage) => {
      this.handleWsConnection(ws, req);
    });

    return new Promise<void>((resolve) => {
      this.server!.listen(this.port, () => {
        logger.info({ port: this.port }, 'iOS channel listening');
        console.log(`\n  iOS channel: http://localhost:${this.port}`);
        console.log(`  WebSocket:   ws://localhost:${this.port}/ws\n`);
        resolve();
      });
    });
  }

  private handleHttp(req: http.IncomingMessage, res: http.ServerResponse): void {
    // CORS headers for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', channel: 'ios' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/message') {
      this.handlePostMessage(req, res);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  }

  private handlePostMessage(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Auth check
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (token !== this.token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { deviceId, text, senderName } = data;

        if (!deviceId || !text) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing deviceId or text' }));
          return;
        }

        const jid = `ios:${deviceId}`;
        const timestamp = new Date().toISOString();
        const msgId = `ios-${Date.now()}`;

        // Store chat metadata
        this.opts.onChatMetadata(jid, timestamp, senderName || 'iOS User', 'ios', false);

        // Check if group is registered
        const group = this.opts.registeredGroups()[jid];
        if (!group) {
          logger.debug({ jid }, 'Message from unregistered iOS device');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'received', registered: false }));
          return;
        }

        // Deliver message to router
        this.opts.onMessage(jid, {
          id: msgId,
          chat_jid: jid,
          sender: deviceId,
          sender_name: senderName || 'iOS User',
          content: `@${ASSISTANT_NAME} ${text}`,
          timestamp,
          is_from_me: false,
        });

        logger.info({ jid, sender: senderName || 'iOS User' }, 'iOS message stored');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'received', registered: true }));
      } catch (err) {
        logger.error({ err }, 'Failed to parse iOS message');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }

  private handleWsConnection(ws: any, req: http.IncomingMessage): void {
    const url = new URL(req.url || '', `http://localhost:${this.port}`);
    const token = url.searchParams.get('token') || '';
    const deviceId = url.searchParams.get('deviceId') || '';

    if (token !== this.token) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    if (!deviceId) {
      ws.close(4002, 'Missing deviceId');
      return;
    }

    const jid = `ios:${deviceId}`;
    this.clients.set(jid, { ws, deviceId, jid });

    logger.info({ jid, deviceId }, 'iOS client connected via WebSocket');

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'message' && msg.text) {
          const timestamp = new Date().toISOString();
          const msgId = `ios-${Date.now()}`;

          this.opts.onChatMetadata(jid, timestamp, msg.senderName || 'iOS User', 'ios', false);

          const group = this.opts.registeredGroups()[jid];
          if (!group) {
            ws.send(JSON.stringify({ type: 'error', error: 'Device not registered' }));
            return;
          }

          this.opts.onMessage(jid, {
            id: msgId,
            chat_jid: jid,
            sender: deviceId,
            sender_name: msg.senderName || 'iOS User',
            content: `@${ASSISTANT_NAME} ${msg.text}`,
            timestamp,
            is_from_me: false,
          });

          logger.info({ jid }, 'iOS WebSocket message stored');
        }
      } catch (err) {
        logger.error({ err }, 'Failed to parse iOS WebSocket message');
      }
    });

    ws.on('close', () => {
      this.clients.delete(jid);
      logger.info({ jid }, 'iOS client disconnected');
    });

    ws.on('error', (err: Error) => {
      logger.error({ jid, err: err.message }, 'iOS WebSocket error');
      this.clients.delete(jid);
    });

    // Send welcome
    ws.send(JSON.stringify({ type: 'connected', assistant: ASSISTANT_NAME }));
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    const client = this.clients.get(jid);
    if (!client || client.ws.readyState !== 1) {
      logger.warn({ jid }, 'iOS client not connected, message not delivered');
      return;
    }

    try {
      client.ws.send(JSON.stringify({ type: 'message', text }));
      logger.info({ jid, length: text.length }, 'iOS message sent');
    } catch (err) {
      logger.error({ jid, err }, 'Failed to send iOS message');
    }
  }

  isConnected(): boolean {
    return this.server !== null;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('ios:');
  }

  async disconnect(): Promise<void> {
    for (const client of this.clients.values()) {
      client.ws.close();
    }
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    logger.info('iOS channel stopped');
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    const client = this.clients.get(jid);
    if (!client || client.ws.readyState !== 1) return;

    try {
      client.ws.send(JSON.stringify({ type: 'typing', isTyping }));
    } catch {
      // ignore
    }
  }
}

registerChannel('ios', (opts: ChannelOpts) => {
  const envVars = readEnvFile(['IOS_CHANNEL_TOKEN', 'IOS_CHANNEL_PORT']);
  const token = process.env.IOS_CHANNEL_TOKEN || envVars.IOS_CHANNEL_TOKEN || '';
  if (!token) {
    logger.warn('iOS: IOS_CHANNEL_TOKEN not set');
    return null;
  }
  const port = parseInt(
    process.env.IOS_CHANNEL_PORT || envVars.IOS_CHANNEL_PORT || String(DEFAULT_PORT),
    10,
  );
  return new IosChannel(port, token, opts);
});
