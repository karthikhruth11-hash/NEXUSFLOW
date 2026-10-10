import { useState, type FC } from 'react';
import { AlertRecord } from '@nexusflow/shared';
import { CheckCircle2, ShieldAlert, Check, XCircle } from 'lucide-react';

interface AlertsViewProps {
  alerts: AlertRecord[];
  onAcknowledge: (alertId: string) => void;
  onResolve: (alertId: string) => void;
}

export const AlertsView: FC<AlertsViewProps> = ({
  alerts,
  onAcknowledge,
  onResolve,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'active') return a.state === 'FIRING' || a.state === 'ACKNOWLEDGED';
    if (filter === 'resolved') return a.state === 'RESOLVED';
    return true;
  });

  return (
    <div style={{ flex: 1, backgroundColor: '#090d16', padding: 24, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldAlert className="text-rose-500" /> Managed Alert State Machine
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            Lifecycle: OK &rarr; PENDING &rarr; FIRING &rarr; ACKNOWLEDGED &rarr; RESOLVED
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 6, backgroundColor: '#111827', padding: 4, borderRadius: 6, border: '1px solid #1e293b' }}>
          {(['all', 'active', 'resolved'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                border: 'none',
                backgroundColor: filter === mode ? '#06b6d4' : 'transparent',
                color: filter === mode ? '#090d16' : '#94a3b8',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Table */}
      {filteredAlerts.length === 0 ? (
        <div
          style={{
            padding: 60,
            textAlign: 'center',
            backgroundColor: '#111827',
            borderRadius: 8,
            border: '1px solid #1e293b',
            color: '#64748b',
          }}
        >
          <CheckCircle2 size={40} style={{ margin: '0 auto 12px auto', color: '#10b981' }} />
          <h3 style={{ color: '#f8fafc', fontSize: 16 }}>All systems normal</h3>
          <p style={{ fontSize: 13, marginTop: 4 }}>No active alerts matching filter.</p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#111827', borderRadius: 8, border: '1px solid #1e293b', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>State</th>
                <th style={{ padding: '12px 16px' }}>Severity</th>
                <th style={{ padding: '12px 16px' }}>Title & Rule</th>
                <th style={{ padding: '12px 16px' }}>Device</th>
                <th style={{ padding: '12px 16px' }}>Observed</th>
                <th style={{ padding: '12px 16px' }}>Time</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map((alert) => (
                <tr key={alert.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  {/* State badge */}
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor:
                          alert.state === 'FIRING'
                            ? '#381216'
                            : alert.state === 'ACKNOWLEDGED'
                            ? '#382b12'
                            : '#123824',
                        color:
                          alert.state === 'FIRING'
                            ? '#f43f5e'
                            : alert.state === 'ACKNOWLEDGED'
                            ? '#f59e0b'
                            : '#10b981',
                        border: `1px solid ${
                          alert.state === 'FIRING'
                            ? '#f43f5e'
                            : alert.state === 'ACKNOWLEDGED'
                            ? '#f59e0b'
                            : '#10b981'
                        }`,
                      }}
                    >
                      {alert.state}
                    </span>
                  </td>

                  {/* Severity */}
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: alert.severity === 'critical' ? '#f43f5e' : '#f59e0b',
                      }}
                    >
                      {alert.severity}
                    </span>
                  </td>

                  {/* Title */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#f8fafc' }}>{alert.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      Threshold: {alert.condition} {alert.threshold}
                    </div>
                  </td>

                  {/* Device */}
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#06b6d4' }}>
                    {alert.deviceId}
                  </td>

                  {/* Observed Value */}
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#f8fafc' }}>
                    {alert.observedValue.toFixed(1)}
                  </td>

                  {/* Time */}
                  <td style={{ padding: '12px 16px', fontSize: 11, color: '#64748b' }}>
                    {new Date(alert.updatedAt || alert.createdAt).toLocaleTimeString()}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {alert.state === 'FIRING' && (
                        <button
                          onClick={() => onAcknowledge(alert.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            backgroundColor: '#272010',
                            border: '1px solid #b45309',
                            color: '#fbbf24',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Check size={12} /> Ack
                        </button>
                      )}

                      {(alert.state === 'FIRING' || alert.state === 'ACKNOWLEDGED') && (
                        <button
                          onClick={() => onResolve(alert.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            backgroundColor: '#10271b',
                            border: '1px solid #047857',
                            color: '#34d399',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <XCircle size={12} /> Resolve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
