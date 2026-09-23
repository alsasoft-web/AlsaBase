import { Response, Request, Router } from 'express';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { Server as SocketIOServer, Socket as SocketIOSocket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';

export interface SSEClient {
  id: string;
  res: Response;
  subscriptions: Set<string>;
  connectedAt: string;
}

export interface WSClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  connectedAt: string;
}

export interface RecordEventPayload {
  action: 'create' | 'update' | 'delete';
  collection: string;
  record: any;
  timestamp: string;
}

export interface CustomEventPayload {
  topic: string;
  data: any;
  event?: string;
  timestamp: string;
}

// Active connected SSE, WebSocket, and Socket.IO instances
const activeClients = new Map<string, SSEClient>();
const activeWsClients = new Map<string, WSClient>();
let wssInstance: WebSocketServer | null = null;
let ioInstance: SocketIOServer | null = null;

// Backend hook listeners for record events: collection -> Map<action, Set<Function>>
const recordListeners = new Map<string, Map<string, Set<Function>>>();

// Backend hook listeners for custom web events: topic -> Set<Function>
const customEventListeners = new Map<string, Set<Function>>();

// Periodic heartbeat interval (15s)
let heartbeatInterval: NodeJS.Timeout | null = null;

function ensureHeartbeat() {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(() => {
    const pingData = `: ping ${Date.now()}\n\n`;
    for (const [clientId, client] of activeClients.entries()) {
      try {
        client.res.write(pingData);
      } catch (err) {
        activeClients.delete(clientId);
      }
    }
  }, 15000);
  if (heartbeatInterval.unref) {
    heartbeatInterval.unref();
  }
}

// Register a new Server-Sent Events client
export function registerSSEClient(req: Request, res: Response, initialTopics: string[] = []): string {
  const clientId = crypto.randomUUID();

  // Set mandatory SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*'
  });

  // Create client entry
  const subs = new Set<string>();
  for (const t of initialTopics) {
    if (t && t.trim()) subs.add(t.trim());
  }
  // Default to subscribing to '*' if no topic specified
  if (subs.size === 0) {
    subs.add('*');
  }

  const client: SSEClient = {
    id: clientId,
    res,
    subscriptions: subs,
    connectedAt: new Date().toISOString()
  };

  activeClients.set(clientId, client);
  ensureHeartbeat();

  // Send initial handshake message
  const handshake = {
    clientId,
    status: 'connected',
    subscriptions: Array.from(subs),
    serverTime: new Date().toISOString()
  };
  res.write(`event: ALSA_CONNECT\ndata: ${JSON.stringify(handshake)}\n\n`);

  // Handle client disconnect
  req.on('close', () => {
    activeClients.delete(clientId);
    console.log(`[Realtime] Client disconnected: ${clientId} (remaining: ${activeClients.size})`);
  });

  console.log(`[Realtime] Client connected: ${clientId} (subscriptions: ${Array.from(subs).join(', ')})`);
  return clientId;
}

// Update client subscriptions dynamically
export function updateClientSubscriptions(clientId: string, subscriptions: string[]): boolean {
  const client = activeClients.get(clientId);
  if (!client) return false;

  client.subscriptions.clear();
  for (const s of subscriptions) {
    if (s && s.trim()) client.subscriptions.add(s.trim());
  }

  // Notify client of updated subscriptions
  client.res.write(`event: ALSA_SUBSCRIPTIONS\ndata: ${JSON.stringify({ subscriptions: Array.from(client.subscriptions) })}\n\n`);
  return true;
}

// Broadcast live system log events to Socket.IO, WebSocket, and SSE clients
export function broadcastLogEvent(log: any) {
  const payload = {
    type: 'log',
    topic: 'logs',
    log,
    timestamp: new Date().toISOString()
  };

  // 1. Dispatch to Socket.IO clients
  if (ioInstance) {
    ioInstance.to('logs').emit('logs', payload);
    ioInstance.to('*').emit('logs', payload);
    ioInstance.emit('log', payload);
  }

  const payloadString = JSON.stringify(payload);
  const eventMsg = `event: logs\ndata: ${payloadString}\n\n`;
  const genericMsg = `event: *\ndata: ${payloadString}\n\n`;

  // 2. Dispatch to SSE clients
  for (const client of activeClients.values()) {
    try {
      if (client.subscriptions.has('logs') || client.subscriptions.has('*')) {
        client.res.write(client.subscriptions.has('logs') ? eventMsg : genericMsg);
      }
    } catch {
      activeClients.delete(client.id);
    }
  }

  // 3. Dispatch to WebSocket clients
  for (const client of activeWsClients.values()) {
    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        if (client.subscriptions.has('logs') || client.subscriptions.has('*')) {
          client.ws.send(payloadString);
        }
      }
    } catch {
      activeWsClients.delete(client.id);
    }
  }
}

// Broadcast collection record changes (create, update, delete)
export function broadcastRecordEvent(action: 'create' | 'update' | 'delete', collection: string, record: any) {
  const payload: RecordEventPayload = {
    action,
    collection,
    record,
    timestamp: new Date().toISOString()
  };

  // 1. Dispatch to Socket.IO clients
  if (ioInstance) {
    ioInstance.to(collection).emit(collection, payload);
    ioInstance.to(collection).emit('record', payload);
    if (record?.id) {
      ioInstance.to(`${collection}/${record.id}`).emit(`${collection}/${record.id}`, payload);
      ioInstance.to(`${collection}/${record.id}`).emit('record', payload);
    }
    ioInstance.to('*').emit('*', payload);
    ioInstance.to('*').emit('record', payload);
  }

  const payloadString = JSON.stringify(payload);
  const eventMsg = `event: ${collection}\ndata: ${payloadString}\n\n`;
  const genericMsg = `event: *\ndata: ${payloadString}\n\n`;

  // 2. Dispatch to SSE clients
  for (const client of activeClients.values()) {
    try {
      const matchSpecific = client.subscriptions.has(collection);
      const matchRecord = record?.id && client.subscriptions.has(`${collection}/${record.id}`);
      const matchAll = client.subscriptions.has('*');

      if (matchSpecific || matchRecord) {
        client.res.write(eventMsg);
      } else if (matchAll) {
        client.res.write(genericMsg);
      }
    } catch (err) {
      activeClients.delete(client.id);
    }
  }

  // 3. Dispatch to WebSocket clients
  const wsMsg = JSON.stringify({ type: 'record', topic: collection, ...payload });
  for (const client of activeWsClients.values()) {
    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        const matchSpecific = client.subscriptions.has(collection);
        const matchRecord = record?.id && client.subscriptions.has(`${collection}/${record.id}`);
        const matchAll = client.subscriptions.has('*');

        if (matchSpecific || matchRecord || matchAll) {
          client.ws.send(wsMsg);
        }
      }
    } catch {
      activeWsClients.delete(client.id);
    }
  }

  // Trigger backend lifecycle listeners asynchronously
  triggerBackendRecordHooks(action, collection, payload);
}

// Broadcast custom web events
export function broadcastCustomEvent(topic: string, data: any, eventName?: string) {
  const payload: CustomEventPayload = {
    topic,
    data,
    event: eventName || topic,
    timestamp: new Date().toISOString()
  };

  const eventNameToSend = eventName || topic;

  // 1. Dispatch to Socket.IO clients
  if (ioInstance) {
    ioInstance.to(topic).emit(eventNameToSend, payload);
    ioInstance.to(topic).emit('custom', payload);
    ioInstance.to('*').emit(eventNameToSend, payload);
    ioInstance.to('*').emit('custom', payload);
  }

  const payloadString = JSON.stringify(payload);
  const eventMsg = `event: ${eventNameToSend}\ndata: ${payloadString}\n\n`;
  const genericMsg = `event: *\ndata: ${payloadString}\n\n`;

  // 2. Dispatch to SSE clients
  for (const client of activeClients.values()) {
    try {
      const matchTopic = client.subscriptions.has(topic);
      const matchAll = client.subscriptions.has('*');

      if (matchTopic) {
        client.res.write(eventMsg);
      } else if (matchAll) {
        client.res.write(genericMsg);
      }
    } catch (err) {
      activeClients.delete(client.id);
    }
  }

  // 3. Dispatch to WebSocket clients
  const wsMsg = JSON.stringify({ type: 'custom', ...payload });
  for (const client of activeWsClients.values()) {
    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        const matchTopic = client.subscriptions.has(topic);
        const matchAll = client.subscriptions.has('*');

        if (matchTopic || matchAll) {
          client.ws.send(wsMsg);
        }
      }
    } catch {
      activeWsClients.delete(client.id);
    }
  }

  // Trigger backend custom event listeners
  triggerBackendCustomEventHooks(topic, payload);
}

// Initialize native WebSocket Server attached to HTTP server
export function initWebSocketServer(server: HttpServer) {
  if (wssInstance) return wssInstance;

  wssInstance = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const rawUrl = request.url || '';
    const pathname = rawUrl.split('?')[0];

    if (
      pathname === '/api/realtime/ws' ||
      pathname === '/api/ws' ||
      pathname === '/ws' ||
      pathname.startsWith('/api/realtime/ws')
    ) {
      wssInstance!.handleUpgrade(request, socket, head, (ws) => {
        wssInstance!.emit('connection', ws, request);
      });
    }
  });

  wssInstance.on('connection', (ws: WebSocket, req) => {
    const clientId = crypto.randomUUID();
    const subs = new Set<string>(['*']); // default subscribe all

    const client: WSClient = {
      id: clientId,
      ws,
      subscriptions: subs,
      connectedAt: new Date().toISOString(),
    };

    activeWsClients.set(clientId, client);
    console.log(`[WebSocket] Client connected: ${clientId} (active: ${activeWsClients.size})`);

    // Send connection handshake
    try {
      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        subscriptions: Array.from(subs),
        serverTime: new Date().toISOString(),
      }));
    } catch {}

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.action === 'subscribe' || msg.type === 'subscribe') {
          const topics = Array.isArray(msg.topic) ? msg.topic : [msg.topic || msg.topicName || msg.subscriptions];
          for (const t of topics.flat()) {
            if (t && typeof t === 'string') client.subscriptions.add(t.trim());
          }
          ws.send(JSON.stringify({
            type: 'subscriptions',
            subscriptions: Array.from(client.subscriptions),
          }));
        } else if (msg.action === 'unsubscribe' || msg.type === 'unsubscribe') {
          const topics = Array.isArray(msg.topic) ? msg.topic : [msg.topic || msg.topicName || msg.subscriptions];
          for (const t of topics.flat()) {
            if (t && typeof t === 'string') client.subscriptions.delete(t.trim());
          }
          ws.send(JSON.stringify({
            type: 'subscriptions',
            subscriptions: Array.from(client.subscriptions),
          }));
        } else if (msg.action === 'ping' || msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {}
    });

    ws.on('close', () => {
      activeWsClients.delete(clientId);
      console.log(`[WebSocket] Client disconnected: ${clientId} (remaining: ${activeWsClients.size})`);
    });

    ws.on('error', () => {
      activeWsClients.delete(clientId);
    });
  });

  console.log('[WebSocket] Realtime WebSocket server initialized on /api/realtime/ws');
  return wssInstance;
}

// Initialize Socket.IO Server attached to HTTP server
export function initSocketIOServer(server: HttpServer): SocketIOServer {
  if (ioInstance) return ioInstance;

  ioInstance = new SocketIOServer(server, {
    path: '/api/socket.io',
    cors: {
      origin: true,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  ioInstance.on('connection', (socket: SocketIOSocket) => {
    // Automatically join default room '*'
    socket.join('*');

    // Send connection greeting with client metadata
    socket.emit('connected', {
      clientId: socket.id,
      status: 'connected',
      serverTime: new Date().toISOString(),
    });

    // Handle subscribe to topics/collections
    socket.on('subscribe', (data: any) => {
      const rawTopics = Array.isArray(data)
        ? data
        : typeof data === 'string'
        ? [data]
        : Array.isArray(data?.topics)
        ? data.topics
        : [data?.topic || data?.collection || '*'];

      const topics: string[] = [];
      for (const t of rawTopics.flat()) {
        if (t && typeof t === 'string') {
          const trimmed = t.trim();
          if (trimmed) {
            socket.join(trimmed);
            topics.push(trimmed);
          }
        }
      }

      socket.emit('subscriptions', {
        clientId: socket.id,
        subscriptions: Array.from(socket.rooms),
      });
    });

    // Handle unsubscribe from topics/collections
    socket.on('unsubscribe', (data: any) => {
      const rawTopics = Array.isArray(data)
        ? data
        : typeof data === 'string'
        ? [data]
        : Array.isArray(data?.topics)
        ? data.topics
        : [data?.topic || data?.collection];

      for (const t of rawTopics.flat()) {
        if (t && typeof t === 'string') {
          socket.leave(t.trim());
        }
      }

      socket.emit('subscriptions', {
        clientId: socket.id,
        subscriptions: Array.from(socket.rooms),
      });
    });

    // Handle publishing custom events from client socket
    socket.on('publish', (payload: any) => {
      if (payload && payload.topic) {
        broadcastCustomEvent(payload.topic, payload.data ?? {}, payload.event);
      }
    });

    // Handle ping/pong
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });
  });

  console.log('[Socket.IO] Realtime Socket.IO server initialized on /api/socket.io');
  return ioInstance;
}

export function getSocketIOServer(): SocketIOServer | null {
  return ioInstance;
}

// Register backend record event listener
export function onRecordEvent(action: 'create' | 'update' | 'delete' | '*', collection: string, callback: Function) {
  if (!recordListeners.has(collection)) {
    recordListeners.set(collection, new Map());
  }
  const actionsMap = recordListeners.get(collection)!;
  if (!actionsMap.has(action)) {
    actionsMap.set(action, new Set());
  }
  actionsMap.get(action)!.add(callback);
}

// Register backend custom web event listener
export function onCustomEvent(topic: string, callback: Function) {
  if (!customEventListeners.has(topic)) {
    customEventListeners.set(topic, new Set());
  }
  customEventListeners.get(topic)!.add(callback);
}

// Clear all backend listeners (used on hooks reload)
export function clearBackendEventListeners() {
  recordListeners.clear;
  recordListeners.clear();
  customEventListeners.clear();
}

// Trigger backend lifecycle hooks
async function triggerBackendRecordHooks(action: 'create' | 'update' | 'delete', collection: string, payload: RecordEventPayload) {
  // Check specific collection listeners
  const colMap = recordListeners.get(collection);
  if (colMap) {
    const actionSet = colMap.get(action);
    if (actionSet) {
      for (const fn of actionSet) {
        try {
          await fn(payload);
        } catch (err) {
          console.error(`[Hooks:Event] Error in ${collection}:${action} listener:`, err);
        }
      }
    }
    const allActionSet = colMap.get('*');
    if (allActionSet) {
      for (const fn of allActionSet) {
        try {
          await fn(payload);
        } catch (err) {
          console.error(`[Hooks:Event] Error in ${collection}:* listener:`, err);
        }
      }
    }
  }

  // Check wildcard collection listeners
  const wildMap = recordListeners.get('*');
  if (wildMap) {
    const actionSet = wildMap.get(action);
    if (actionSet) {
      for (const fn of actionSet) {
        try {
          await fn(payload);
        } catch (err) {
          console.error(`[Hooks:Event] Error in *:${action} listener:`, err);
        }
      }
    }
    const allSet = wildMap.get('*');
    if (allSet) {
      for (const fn of allSet) {
        try {
          await fn(payload);
        } catch (err) {
          console.error(`[Hooks:Event] Error in *:* listener:`, err);
        }
      }
    }
  }
}

// Trigger backend custom event hooks
async function triggerBackendCustomEventHooks(topic: string, payload: CustomEventPayload) {
  const specificSet = customEventListeners.get(topic);
  if (specificSet) {
    for (const fn of specificSet) {
      try {
        await fn(payload.data, payload);
      } catch (err) {
        console.error(`[Hooks:Event] Error in event:${topic} listener:`, err);
      }
    }
  }

  const wildSet = customEventListeners.get('*');
  if (wildSet) {
    for (const fn of wildSet) {
      try {
        await fn(payload.data, payload);
      } catch (err) {
        console.error(`[Hooks:Event] Error in event:* listener:`, err);
      }
    }
  }
}

// Express Realtime Router
export const realtimeRouter = Router();

// SSE subscription endpoint
realtimeRouter.get('/realtime', (req: Request, res: Response) => {
  const topicsParam = (req.query.topics as string) || (req.query.subscriptions as string) || '';
  const initialTopics = topicsParam ? topicsParam.split(',').map((s) => s.trim()).filter(Boolean) : [];
  registerSSEClient(req, res, initialTopics);
});

// Alias for /api/events
realtimeRouter.get('/events', (req: Request, res: Response) => {
  const topicsParam = (req.query.topics as string) || (req.query.subscriptions as string) || '';
  const initialTopics = topicsParam ? topicsParam.split(',').map((s) => s.trim()).filter(Boolean) : [];
  registerSSEClient(req, res, initialTopics);
});

// Update subscriptions endpoint
realtimeRouter.post('/realtime/subscriptions', (req: Request, res: Response) => {
  const { clientId, subscriptions } = req.body;
  if (!clientId || !Array.isArray(subscriptions)) {
    return res.status(400).json({ error: 'Missing clientId or subscriptions array' });
  }

  const success = updateClientSubscriptions(clientId, subscriptions);
  if (!success) {
    return res.status(404).json({ error: 'Client not found or disconnected' });
  }

  res.json({ success: true, clientId, subscriptions });
});

// Publish custom web events via REST
realtimeRouter.post(['/realtime/publish', '/events/emit'], (req: Request, res: Response) => {
  const { topic, data, event } = req.body;
  if (!topic) {
    return res.status(400).json({ error: 'Field "topic" is required to publish an event' });
  }

  broadcastCustomEvent(topic, data ?? {}, event);
  res.json({ success: true, topic, publishedAt: new Date().toISOString() });
});

// Status endpoint
realtimeRouter.get('/realtime/status', (_req: Request, res: Response) => {
  const clientsList = Array.from(activeClients.values()).map((c) => ({
    id: c.id,
    type: 'sse',
    subscriptions: Array.from(c.subscriptions),
    connectedAt: c.connectedAt
  }));

  const socketIOClientsCount = ioInstance ? ioInstance.sockets.sockets.size : 0;
  const wsClientsCount = activeWsClients.size;

  res.json({
    activeClientsCount: activeClients.size + wsClientsCount + socketIOClientsCount,
    sseClientsCount: activeClients.size,
    wsClientsCount,
    socketIOClientsCount,
    clients: clientsList
  });
});
