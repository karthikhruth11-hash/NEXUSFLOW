import { memo, type ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Activity,
  Cpu,
  BarChart2,
  AlertTriangle,
  Clock,
  Radio,
  Sliders,
  Bell,
  Send,
  Terminal,
} from 'lucide-react';

const iconMap: Record<string, ReactNode> = {
  'sensor-input': <Activity size={16} className="text-cyan-400" />,
  'moving-average': <Cpu size={16} className="text-cyan-400" />,
  'window-stats': <BarChart2 size={16} className="text-cyan-400" />,
  'threshold-condition': <AlertTriangle size={16} className="text-amber-400" />,
  'for-duration': <Clock size={16} className="text-amber-400" />,
  'absence-heartbeat': <Radio size={16} className="text-rose-400" />,
  'boolean-logic': <Sliders size={16} className="text-indigo-400" />,
  'dashboard-alert': <Bell size={16} className="text-rose-400" />,
  'notify': <Send size={16} className="text-emerald-400" />,
  'logger': <Terminal size={16} className="text-slate-400" />,
};

const portContracts: Record<
  string,
  {
    inputs: Array<{ id: string; name: string; type: 'number' | 'boolean' | 'event' }>;
    outputs: Array<{ id: string; name: string; type: 'number' | 'boolean' | 'event' }>;
  }
> = {
  'sensor-input': {
    inputs: [],
    outputs: [
      { id: 'value', name: 'Value', type: 'number' },
      { id: 'event', name: 'Event', type: 'event' },
    ],
  },
  'moving-average': {
    inputs: [{ id: 'input', name: 'Input', type: 'number' }],
    outputs: [{ id: 'output', name: 'Avg', type: 'number' }],
  },
  'window-stats': {
    inputs: [{ id: 'input', name: 'Input', type: 'number' }],
    outputs: [{ id: 'output', name: 'Stat', type: 'number' }],
  },
  'threshold-condition': {
    inputs: [{ id: 'input', name: 'Input', type: 'number' }],
    outputs: [{ id: 'output', name: 'Met', type: 'boolean' }],
  },
  'for-duration': {
    inputs: [{ id: 'input', name: 'Condition', type: 'boolean' }],
    outputs: [{ id: 'output', name: 'Held', type: 'boolean' }],
  },
  'absence-heartbeat': {
    inputs: [{ id: 'input', name: 'Stream', type: 'number' }],
    outputs: [{ id: 'output', name: 'Absent', type: 'boolean' }],
  },
  'boolean-logic': {
    inputs: [
      { id: 'in_a', name: 'A', type: 'boolean' },
      { id: 'in_b', name: 'B', type: 'boolean' },
    ],
    outputs: [{ id: 'output', name: 'Out', type: 'boolean' }],
  },
  'dashboard-alert': {
    inputs: [{ id: 'trigger', name: 'Trigger', type: 'boolean' }],
    outputs: [{ id: 'alertEvent', name: 'Alert', type: 'event' }],
  },
  'notify': {
    inputs: [{ id: 'event', name: 'Event', type: 'event' }],
    outputs: [],
  },
  'logger': {
    inputs: [{ id: 'input_num', name: 'In', type: 'number' }],
    outputs: [{ id: 'passthrough', name: 'Pass', type: 'number' }],
  },
};

export const CustomNode = memo(({ data, selected }: { data: any; selected?: boolean }) => {
  const nodeType = data.type || 'sensor-input';
  const ports = portContracts[nodeType] || { inputs: [], outputs: [] };
  const liveValue = data.liveValue;

  return (
    <div
      style={{
        width: 220,
        backgroundColor: '#111827',
        borderRadius: 8,
        border: selected ? '2px solid #06b6d4' : '1px solid #1e293b',
        boxShadow: selected
          ? '0 0 16px rgba(6, 182, 212, 0.4)'
          : '0 4px 12px rgba(0, 0, 0, 0.4)',
        color: '#f8fafc',
        fontSize: 12,
        position: 'relative',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Node Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid #1e293b',
          backgroundColor: '#0f172a',
          borderTopLeftRadius: 7,
          borderTopRightRadius: 7,
        }}
      >
        <span>{iconMap[nodeType] || <Activity size={16} />}</span>
        <span style={{ fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {data.label || nodeType}
        </span>
      </div>

      {/* Node Body with Config Summary */}
      <div style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 11 }}>
        {nodeType === 'sensor-input' && (
          <div>
            Dev: <strong style={{ color: '#f8fafc' }}>{data.config?.deviceId || 'turbine-01'}</strong>
            <br />
            Metric: <strong style={{ color: '#06b6d4' }}>{data.config?.measurement || 'temperature'}</strong>
          </div>
        )}
        {nodeType === 'moving-average' && (
          <div>
            Mode: <strong style={{ color: '#f8fafc' }}>{data.config?.mode || 'count'}</strong>
            <br />
            Window: <strong style={{ color: '#06b6d4' }}>{data.config?.size ?? 5} samples</strong>
          </div>
        )}
        {nodeType === 'threshold-condition' && (
          <div>
            Rule: <strong style={{ color: '#f59e0b' }}>{data.config?.operator || '>'} {data.config?.threshold ?? 80}</strong>
            <br />
            Hysteresis: <strong style={{ color: '#10b981' }}>{data.config?.hysteresis ?? 75}</strong>
          </div>
        )}
        {nodeType === 'dashboard-alert' && (
          <div>
            Severity: <strong style={{ color: '#f43f5e', textTransform: 'uppercase' }}>{data.config?.severity || 'warning'}</strong>
            <br />
            Cooldown: <strong style={{ color: '#f8fafc' }}>{data.config?.cooldownSeconds ?? 60}s</strong>
          </div>
        )}
        {nodeType === 'notify' && (
          <div>
            Channel: <strong style={{ color: '#10b981' }}>{data.config?.channel || 'sms'}</strong>
          </div>
        )}
        {nodeType === 'boolean-logic' && (
          <div>
            Op: <strong style={{ color: '#6366f1' }}>{data.config?.operation || 'AND'}</strong>
          </div>
        )}
      </div>

      {/* Live Value Overlay if streaming */}
      {liveValue !== undefined && (
        <div
          style={{
            margin: '0 8px 8px 8px',
            padding: '4px 8px',
            backgroundColor: '#0c1a2e',
            borderRadius: 4,
            border: '1px solid #0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 10, color: '#38bdf8', textTransform: 'uppercase', fontWeight: 600 }}>LIVE</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
            {typeof liveValue === 'number'
              ? `${liveValue.toFixed(1)}`
              : typeof liveValue === 'boolean'
              ? (liveValue ? 'TRUE' : 'FALSE')
              : 'EVENT'}
          </span>
        </div>
      )}

      {/* Input Ports (Left) */}
      <div style={{ position: 'relative' }}>
        {ports.inputs.map((p, idx) => {
          const topPercent = ((idx + 1) / (ports.inputs.length + 1)) * 100;
          return (
            <div key={p.id} style={{ position: 'absolute', top: `${topPercent}%`, left: 0, transform: 'translateY(-50%)' }}>
              <Handle
                type="target"
                position={Position.Left}
                id={p.id}
                className={`port-handle port-${p.type}`}
                style={{ left: -6 }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: 10,
                  top: -8,
                  fontSize: 9,
                  color: '#64748b',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Output Ports (Right) */}
      <div style={{ position: 'relative' }}>
        {ports.outputs.map((p, idx) => {
          const topPercent = ((idx + 1) / (ports.outputs.length + 1)) * 100;
          return (
            <div key={p.id} style={{ position: 'absolute', top: `${topPercent}%`, right: 0, transform: 'translateY(-50%)' }}>
              <Handle
                type="source"
                position={Position.Right}
                id={p.id}
                className={`port-handle port-${p.type}`}
                style={{ right: -6 }}
              />
              <span
                style={{
                  position: 'absolute',
                  right: 10,
                  top: -8,
                  fontSize: 9,
                  color: '#64748b',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
