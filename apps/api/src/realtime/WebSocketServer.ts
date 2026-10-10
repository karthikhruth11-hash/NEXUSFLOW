import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { logger } from '../lib/logger.js';
import { telemetryBus } from '../adapters/TelemetryBus.js';
import { AlertService } from '../services/AlertService.js';
import { RuntimeManager } from '../services/RuntimeManager.js';

interface ClientSubscription {
  ws: WebSocket;
  channels: Set<string>;
  tenantId: string;
}

export class NexusWebSocketServer {
  private wss: WSServer;
  private clients = new Map<WebSocket, ClientSubscription>();

  constructor(server: HttpServer) {
    this.wss = new WSServer({ server, path: '/ws' });
    this.init();
  }

  private init(): void {
    logger.info('Initializing RFC 6455 WebSocket Server on /ws...');

    this.wss.on('connection', (ws: WebSocket, req) => {
      const url = new URL(req.url || '', 'http://localhost');
      const tenantId = url.searchParams.get('tenantId') || 'default-tenant';

      const sub: ClientSubscription = {
        ws,
        channels: new Set(['telemetry', 'alerts', 'workflow']), // subscribe to all by default for demo dashboard
        tenantId,
      };

      this.clients.set(ws, sub);
      logger.info({ tenantId, totalClients: this.clients.size }, 'WebSocket client connected');

      ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Welcome to NexusFlow Realtime Bus' }));

      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          } else if (parsed.type === 'subscribe' && parsed.channel) {
            sub.channels.add(parsed.channel);
            ws.send(JSON.stringify({ type: 'SUBSCRIBED', channel: parsed.channel }));
          }
        } catch (err) {
          logger.error({ err }, 'Error handling WebSocket message');
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info({ totalClients: this.clients.size }, 'WebSocket client disconnected');
      });
    });

    // 1. Hook TelemetryBus to broadcast live telemetry to subscribed clients
    telemetryBus.subscribe((record) => {
      this.broadcastToChannel('telemetry', record.tenantId, {
        type: 'TELEMETRY_RECORD',
        data: record,
      });
    });

    // 2. Hook AlertService broadcaster to push real-time alerts
    AlertService.setBroadcaster((event) => {
      this.broadcastToChannel('alerts', event.alert.tenantId, {
        type: event.type,
        data: event.alert,
      });
    });

    // 3. Hook RuntimeManager broadcaster to push live node overlays
    RuntimeManager.setLiveOverlayBroadcaster((event) => {
      this.broadcastToChannel('workflow', 'factory-1', {
        type: 'NODE_LIVE_OUTPUT',
        data: event,
      });
    });
  }

  private broadcastToChannel(channel: string, tenantId: string, payload: unknown): void {
    const raw = JSON.stringify(payload);
    for (const sub of this.clients.values()) {
      if (
        sub.ws.readyState === WebSocket.OPEN &&
        sub.channels.has(channel) &&
        (sub.tenantId === tenantId || sub.tenantId === 'default-tenant')
      ) {
        sub.ws.send(raw);
      }
    }
  }

  close(): void {
    this.wss.close();
  }
}
