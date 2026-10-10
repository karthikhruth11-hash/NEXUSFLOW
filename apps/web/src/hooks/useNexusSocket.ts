import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertRecord, IngestedTelemetryRecord } from '@nexusflow/shared';

export interface UseNexusSocketReturn {
  connected: boolean;
  liveTelemetry: IngestedTelemetryRecord | null;
  alerts: AlertRecord[];
  nodeLiveValues: Record<string, unknown>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
}

export function useNexusSocket(): UseNexusSocketReturn {
  const [connected, setConnected] = useState(false);
  const [liveTelemetry, setLiveTelemetry] = useState<IngestedTelemetryRecord | null>(null);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [nodeLiveValues, setNodeLiveValues] = useState<Record<string, unknown>>({});
  const socketRef = useRef<WebSocket | null>(null);

  // Fetch initial alerts list
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts?tenantId=factory-1');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setAlerts(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch initial alerts:', err);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?tenantId=factory-1`;

    let retryTimeout: any;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'TELEMETRY_RECORD') {
            setLiveTelemetry(msg.data);
          } else if (msg.type === 'ALERT_CREATED') {
            setAlerts((prev) => [msg.data, ...prev.filter((a) => a.id !== msg.data.id)]);
          } else if (msg.type === 'ALERT_UPDATED' || msg.type === 'ALERT_ACKNOWLEDGED' || msg.type === 'ALERT_RESOLVED') {
            setAlerts((prev) =>
              prev.map((a) => (a.id === msg.data.id ? msg.data : a))
            );
          } else if (msg.type === 'NODE_LIVE_OUTPUT') {
            const data = msg.data;
            setNodeLiveValues((prev) => ({
              ...prev,
              [data.nodeId]: data.value,
            }));
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        retryTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      clearTimeout(retryTimeout);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [fetchAlerts]);

  const acknowledgeAlert = async (alertId: string) => {
    await fetch(`/api/alerts/${alertId}/ack?tenantId=factory-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'operator-web' }),
    });
    fetchAlerts();
  };

  const resolveAlert = async (alertId: string) => {
    await fetch(`/api/alerts/${alertId}/resolve?tenantId=factory-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'operator-web' }),
    });
    fetchAlerts();
  };

  return {
    connected,
    liveTelemetry,
    alerts,
    nodeLiveValues,
    acknowledgeAlert,
    resolveAlert,
  };
}
