import { useState, useEffect, useRef, type FC } from 'react';
import { Play, Square, FastForward, CheckCircle2 } from 'lucide-react';
import { IngestedTelemetryRecord } from '@nexusflow/shared';

interface SimulatorViewProps {
  latestTelemetry: IngestedTelemetryRecord | null;
}

export const SimulatorView: FC<SimulatorViewProps> = ({ latestTelemetry }) => {
  const [device, setDevice] = useState('turbine-01');
  const [scenario, setScenario] = useState('breach');
  const [isSimulating, setIsSimulating] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [replayResult, setReplayResult] = useState<any>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const timerRef = useRef<any>(null);

  // Load device key from backend
  useEffect(() => {
    fetch('/api/devices?tenantId=factory-1')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.length > 0) {
          // If seeded devices exist, obtain first device key or create
          const d = data.data.find((dev: any) => dev.id === device) || data.data[0];
          if (d) setDevice(d.id);
        }
      })
      .catch(console.error);
  }, [device]);

  // Telemetry generator tick
  const sendTick = async () => {
    try {
      const now = new Date().toISOString();
      let temp = 70.0;
      if (scenario === 'breach') {
        temp = 88.5 + (Math.random() * 4 - 2);
      } else if (scenario === 'flapping') {
        temp = 79.5 + Math.sin(Date.now() / 1000) * 3.5;
      } else if (scenario === 'normal') {
        temp = 70.0 + (Math.random() * 2 - 1);
      }

      const payload = {
        deviceId: device,
        timestamp: now,
        measurements: {
          temperature: { value: Math.round(temp * 10) / 10, unit: 'celsius' },
          vibration: { value: 1.8, unit: 'mm/s' },
        },
      };

      // Ingest into API
      // If we don't have apiKey in UI state, create or fetch a device key
      let key = apiKey;
      if (!key) {
        const devRes = await fetch('/api/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: 'factory-1',
            id: device,
            name: device,
          }),
        });
        const devJson = await devRes.json();
        if (devJson.data?.apiKey) {
          key = devJson.data.apiKey;
          setApiKey(key);
        }
      }

      await fetch('/api/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-api-key': key || 'devkey_default',
        },
        body: JSON.stringify(payload),
      });

      setSentCount((c) => c + 1);
    } catch (err) {
      console.error('Simulator tick error:', err);
    }
  };

  const toggleSimulator = () => {
    if (isSimulating) {
      clearInterval(timerRef.current);
      setIsSimulating(false);
    } else {
      setIsSimulating(true);
      sendTick();
      timerRef.current = setInterval(sendTick, 1000);
    }
  };

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const handleRunReplay = async () => {
    setIsReplaying(true);
    try {
      const res = await fetch('/api/workflows/wf-turbine-mvp/replay?tenantId=factory-1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device }),
      });
      const json = await res.json();
      if (json.success) {
        setReplayResult(json.data);
      }
    } catch (err) {
      console.error('Replay error:', err);
    } finally {
      setIsReplaying(false);
    }
  };

  return (
    <div style={{ flex: 1, backgroundColor: '#090d16', padding: 24, overflowY: 'auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc', marginBottom: 20 }}>
        Device Telemetry Simulator & Historical Replay
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Panel 1: Live Driver */}
        <div style={{ backgroundColor: '#111827', borderRadius: 8, border: '1px solid #1e293b', padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase', marginBottom: 16 }}>
            Live Synthetic Telemetry Generator
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Target IoT Device
              </label>
              <select
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: 6,
                  color: '#f8fafc',
                  fontSize: 13,
                }}
              >
                <option value="turbine-01">turbine-01 (Main Steam Turbine Bay 1)</option>
                <option value="turbine-02">turbine-02 (Turbine Generator Bay 2)</option>
                <option value="pump-01">pump-01 (Coolant Circulation Pump)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Simulation Scenario
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { id: 'normal', label: 'Normal (70°C)' },
                  { id: 'breach', label: 'Breach (> 88°C)' },
                  { id: 'flapping', label: 'Flapping (77-83°C)' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setScenario(s.id)}
                    style={{
                      padding: '8px',
                      borderRadius: 6,
                      border: scenario === s.id ? '1px solid #06b6d4' : '1px solid #1e293b',
                      backgroundColor: scenario === s.id ? '#082f49' : '#0f172a',
                      color: scenario === s.id ? '#38bdf8' : '#94a3b8',
                      fontWeight: 600,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <button
                onClick={toggleSimulator}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: isSimulating ? '#e11d48' : '#059669',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {isSimulating ? <Square size={16} /> : <Play size={16} />}
                {isSimulating ? 'Stop Telemetry Stream' : 'Start Live Telemetry Stream'}
              </button>
            </div>

            {/* Status box */}
            <div
              style={{
                padding: '12px',
                backgroundColor: '#0f172a',
                borderRadius: 6,
                border: '1px solid #1e293b',
                fontSize: 12,
                color: '#94a3b8',
              }}
            >
              <div>Status: <strong style={{ color: isSimulating ? '#10b981' : '#64748b' }}>{isSimulating ? 'STREAMING ACTIVE (1 Hz)' : 'IDLE'}</strong></div>
              <div>Events Sent: <strong style={{ color: '#f8fafc' }}>{sentCount}</strong></div>
              {latestTelemetry && (
                <div style={{ marginTop: 6, color: '#38bdf8', fontFamily: 'monospace' }}>
                  Latest: {latestTelemetry.deviceId} | temp: {latestTelemetry.measurements.temperature?.value}°C
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel 2: Replay / Backtest */}
        <div style={{ backgroundColor: '#111827', borderRadius: 8, border: '1px solid #1e293b', padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', marginBottom: 16 }}>
            Deterministic Historical Replay / Backtest
          </h2>

          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
            Dry-run a workflow against historical telemetry stored in MongoDB. Returns would-be alerts without dispatching notifications.
          </p>

          <button
            onClick={handleRunReplay}
            disabled={isReplaying}
            style={{
              padding: '10px 16px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: '#d97706',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 13,
              cursor: isReplaying ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <FastForward size={16} />
            {isReplaying ? 'Running Replay...' : `Run Replay for ${device}`}
          </button>

          {replayResult && (
            <div
              style={{
                padding: 16,
                backgroundColor: '#0f172a',
                borderRadius: 6,
                border: '1px solid #1e293b',
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontWeight: 600, marginBottom: 8 }}>
                <CheckCircle2 size={16} /> Replay Completed in {replayResult.executionTimeMs} ms
              </div>
              <div style={{ color: '#94a3b8' }}>
                Events Replayed: <strong style={{ color: '#f8fafc' }}>{replayResult.totalEventsProcessed}</strong>
                <br />
                Would-Be Alerts: <strong style={{ color: '#f43f5e' }}>{replayResult.totalAlertsGenerated}</strong>
              </div>

              {replayResult.alerts.length > 0 && (
                <div style={{ marginTop: 12, maxHeight: 150, overflowY: 'auto' }}>
                  {replayResult.alerts.map((alt: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: '#1e293b',
                        borderRadius: 4,
                        marginBottom: 4,
                        fontSize: 11,
                      }}
                    >
                      <strong style={{ color: '#f43f5e' }}>{alt.title}</strong>
                      <div style={{ color: '#94a3b8' }}>
                        Observed: {alt.observedValue.toFixed(1)}°C &gt; Threshold: {alt.threshold}°C
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
