import type { FC } from 'react';
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

interface PaletteProps {
  onAddNode: (type: string, label: string) => void;
}

const nodeCategories = [
  {
    title: 'Input',
    nodes: [
      { type: 'sensor-input', label: 'Sensor Input', desc: 'Device telemetry stream', icon: <Activity size={14} className="text-cyan-400" /> },
    ],
  },
  {
    title: 'Processing',
    nodes: [
      { type: 'moving-average', label: 'Moving Average', desc: 'Count / duration mean', icon: <Cpu size={14} className="text-cyan-400" /> },
      { type: 'window-stats', label: 'Window Stats', desc: 'Min / max / slope', icon: <BarChart2 size={14} className="text-cyan-400" /> },
    ],
  },
  {
    title: 'Condition',
    nodes: [
      { type: 'threshold-condition', label: 'Threshold Condition', desc: 'Threshold with hysteresis', icon: <AlertTriangle size={14} className="text-amber-400" /> },
      { type: 'for-duration', label: 'For Duration', desc: 'Debounce hold timer', icon: <Clock size={14} className="text-amber-400" /> },
      { type: 'absence-heartbeat', label: 'Absence / Heartbeat', desc: 'Silence detector', icon: <Radio size={14} className="text-rose-400" /> },
    ],
  },
  {
    title: 'Logic',
    nodes: [
      { type: 'boolean-logic', label: 'Boolean Logic', desc: 'AND, OR, NOT gates', icon: <Sliders size={14} className="text-indigo-400" /> },
    ],
  },
  {
    title: 'Output',
    nodes: [
      { type: 'dashboard-alert', label: 'Dashboard Alert', desc: 'Create managed alert', icon: <Bell size={14} className="text-rose-400" /> },
      { type: 'notify', label: 'Notify', desc: 'SMS / Webhook / Email', icon: <Send size={14} className="text-emerald-400" /> },
      { type: 'logger', label: 'Logger', desc: 'Diagnostic passthrough', icon: <Terminal size={14} className="text-slate-400" /> },
    ],
  },
];

export const Palette: FC<PaletteProps> = ({ onAddNode }) => {
  return (
    <div
      style={{
        width: 240,
        backgroundColor: '#0b1120',
        borderRight: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b' }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#94a3b8' }}>
          Node Palette
        </h2>
        <span style={{ fontSize: 11, color: '#64748b' }}>Click node to add to canvas</span>
      </div>

      <div style={{ padding: '12px' }}>
        {nodeCategories.map((cat) => (
          <div key={cat.title} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
              {cat.title}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cat.nodes.map((node) => (
                <button
                  key={node.type}
                  onClick={() => onAddNode(node.type, node.label)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    backgroundColor: '#111827',
                    border: '1px solid #1e293b',
                    borderRadius: 6,
                    color: '#f8fafc',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#111827')}
                >
                  <div style={{ padding: 4, backgroundColor: '#0f172a', borderRadius: 4 }}>
                    {node.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{node.label}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{node.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
