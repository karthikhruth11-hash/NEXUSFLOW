import type { FC } from 'react';
import { X, Trash2 } from 'lucide-react';

interface ConfigPanelProps {
  node: any;
  onUpdateConfig: (nodeId: string, label: string, config: Record<string, unknown>) => void;
  onDeleteNode: (nodeId: string) => void;
  onClose: () => void;
}

export const ConfigPanel: FC<ConfigPanelProps> = ({
  node,
  onUpdateConfig,
  onDeleteNode,
  onClose,
}) => {
  if (!node) return null;

  const config = node.data?.config || {};
  const label = node.data?.label || node.data?.type;
  const nodeType = node.data?.type;

  const handleChange = (key: string, val: any) => {
    onUpdateConfig(node.id, label, { ...config, [key]: val });
  };

  const handleLabelChange = (newLabel: string) => {
    onUpdateConfig(node.id, newLabel, config);
  };

  return (
    <div
      style={{
        width: 300,
        backgroundColor: '#0b1120',
        borderLeft: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase' }}>
            Node Inspector
          </h2>
          <span style={{ fontSize: 11, color: '#64748b' }}>{nodeType}</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Label */}
        <div>
          <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
            Node Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              backgroundColor: '#111827',
              border: '1px solid #1e293b',
              borderRadius: 4,
              color: '#f8fafc',
              fontSize: 12,
            }}
          />
        </div>

        {/* Dynamic Fields Based on Node Type */}
        {nodeType === 'sensor-input' && (
          <>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Target Device ID
              </label>
              <input
                type="text"
                value={config.deviceId ?? 'turbine-01'}
                onChange={(e) => handleChange('deviceId', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: '#111827',
                  border: '1px solid #1e293b',
                  borderRadius: 4,
                  color: '#f8fafc',
                  fontSize: 12,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Measurement Name
              </label>
              <input
                type="text"
                value={config.measurement ?? 'temperature'}
                onChange={(e) => handleChange('measurement', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: '#111827',
                  border: '1px solid #1e293b',
                  borderRadius: 4,
                  color: '#f8fafc',
                  fontSize: 12,
                }}
              />
            </div>
          </>
        )}

        {nodeType === 'moving-average' && (
          <>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Window Mode
              </label>
              <select
                value={config.mode ?? 'count'}
                onChange={(e) => handleChange('mode', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: '#111827',
                  border: '1px solid #1e293b',
                  borderRadius: 4,
                  color: '#f8fafc',
                  fontSize: 12,
                }}
              >
                <option value="count">Count (last N samples)</option>
                <option value="duration">Duration (seconds)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Window Size
              </label>
              <input
                type="number"
                value={config.size ?? 5}
                onChange={(e) => handleChange('size', parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: '#111827',
                  border: '1px solid #1e293b',
                  borderRadius: 4,
                  color: '#f8fafc',
                  fontSize: 12,
                }}
              />
            </div>
          </>
        )}

        {nodeType === 'threshold-condition' && (
          <>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Comparison Operator
              </label>
              <select
                value={config.operator ?? '>'}
                onChange={(e) => handleChange('operator', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: '#111827',
                  border: '1px solid #1e293b',
                  borderRadius: 4,
                  color: '#f8fafc',
                  fontSize: 12,
                }}
              >
                <option value=">">&gt; (Greater than)</option>
                <option value=">=">&gt;= (Greater or equal)</option>
                <option value="<">&lt; (Less than)</option>
                <option value="<=">&lt;= (Less or equal)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Breach Threshold
              </label>
              <input
                type="number"
                step="0.5"
                value={config.threshold ?? 80.0}
                onChange={(e) => handleChange('threshold', parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: '#111827',
                  border: '1px solid #1e293b',
                  borderRadius: 4,
                  color: '#f8fafc',
                  fontSize: 12,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Clear Hysteresis Band
              </label>
              <input
                type="number"
                step="0.5"
                value={config.hysteresis ?? 75.0}
                onChange={(e) => handleChange('hysteresis', parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: '#111827',
                  border: '1px solid #1e293b',
                  borderRadius: 4,
                  color: '#f8fafc',
                  fontSize: 12,
                }}
              />
            </div>
          </>
        )}

        {nodeType === 'dashboard-alert' && (
          <>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Severity
              </label>
              <select
                value={config.severity ?? 'warning'}
                onChange={(e) => handleChange('severity', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: '#111827',
                  border: '1px solid #1e293b',
                  borderRadius: 4,
                  color: '#f8fafc',
                  fontSize: 12,
                }}
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Alert Title
              </label>
              <input
                type="text"
                value={config.title ?? 'High Temperature Detected'}
                onChange={(e) => handleChange('title', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: '#111827',
                  border: '1px solid #1e293b',
                  borderRadius: 4,
                  color: '#f8fafc',
                  fontSize: 12,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Cooldown (Seconds)
              </label>
              <input
                type="number"
                value={config.cooldownSeconds ?? 60}
                onChange={(e) => handleChange('cooldownSeconds', parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: '#111827',
                  border: '1px solid #1e293b',
                  borderRadius: 4,
                  color: '#f8fafc',
                  fontSize: 12,
                }}
              />
            </div>
          </>
        )}

        {/* Delete button */}
        <button
          onClick={() => onDeleteNode(node.id)}
          style={{
            marginTop: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            backgroundColor: '#271111',
            border: '1px solid #5c1d1d',
            borderRadius: 4,
            color: '#f87171',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <Trash2 size={14} /> Remove Node
        </button>
      </div>
    </div>
  );
};
