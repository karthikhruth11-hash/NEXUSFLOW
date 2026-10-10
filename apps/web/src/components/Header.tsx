import type { FC } from 'react';
import {
  CheckCircle,
  Save,
  UploadCloud,
  Play,
  Square,
  Activity,
  Layers,
  Bell,
  Cpu,
} from 'lucide-react';

interface HeaderProps {
  workflowName: string;
  version: number;
  status: string;
  activeTab: 'canvas' | 'alerts' | 'simulator';
  onTabChange: (tab: 'canvas' | 'alerts' | 'simulator') => void;
  onValidate: () => void;
  onSave: () => void;
  onPublish: () => void;
  onToggleExecution: () => void;
  isRunning: boolean;
  wsConnected: boolean;
  alertCount: number;
}

export const Header: FC<HeaderProps> = ({
  workflowName,
  version,
  status,
  activeTab,
  onTabChange,
  onValidate,
  onSave,
  onPublish,
  onToggleExecution,
  isRunning,
  wsConnected,
  alertCount,
}) => {
  return (
    <header
      style={{
        height: 56,
        backgroundColor: '#0b1120',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        color: '#f8fafc',
      }}
    >
      {/* Brand & Workflow Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: '#082f49',
              border: '1px solid #0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
            }}
          >
            <Activity size={16} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.5, color: '#f8fafc' }}>
            NEXUS<span style={{ color: '#06b6d4' }}>FLOW</span>
          </span>
        </div>

        <div style={{ height: 20, width: 1, backgroundColor: '#1e293b' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{workflowName}</span>
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              backgroundColor: status === 'active' ? '#064e3b' : '#334155',
              color: status === 'active' ? '#34d399' : '#94a3b8',
              border: `1px solid ${status === 'active' ? '#059669' : '#475569'}`,
            }}
          >
            v{version} {status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Center Tab Navigation */}
      <div
        style={{
          display: 'flex',
          backgroundColor: '#0f172a',
          padding: 3,
          borderRadius: 6,
          border: '1px solid #1e293b',
        }}
      >
        <button
          onClick={() => onTabChange('canvas')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 4,
            border: 'none',
            backgroundColor: activeTab === 'canvas' ? '#1e293b' : 'transparent',
            color: activeTab === 'canvas' ? '#f8fafc' : '#94a3b8',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Layers size={14} /> Workflow Builder
        </button>

        <button
          onClick={() => onTabChange('alerts')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 4,
            border: 'none',
            backgroundColor: activeTab === 'alerts' ? '#1e293b' : 'transparent',
            color: activeTab === 'alerts' ? '#f8fafc' : '#94a3b8',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Bell size={14} /> Alerts
          {alertCount > 0 && (
            <span
              style={{
                backgroundColor: '#e11d48',
                color: '#fff',
                borderRadius: 10,
                padding: '0 5px',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {alertCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('simulator')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 4,
            border: 'none',
            backgroundColor: activeTab === 'simulator' ? '#1e293b' : 'transparent',
            color: activeTab === 'simulator' ? '#f8fafc' : '#94a3b8',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Cpu size={14} /> Simulator & Replay
        </button>
      </div>

      {/* Right Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* WS Connection Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: wsConnected ? '#10b981' : '#f43f5e',
            backgroundColor: wsConnected ? '#064e3b22' : '#88133722',
            padding: '4px 8px',
            borderRadius: 4,
            border: `1px solid ${wsConnected ? '#059669' : '#e11d48'}`,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: wsConnected ? '#10b981' : '#f43f5e',
            }}
          />
          {wsConnected ? 'LIVE WS' : 'OFFLINE'}
        </div>

        <button
          onClick={onValidate}
          title="Validate Graph Structure and Port Connections"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            backgroundColor: '#111827',
            border: '1px solid #1e293b',
            color: '#cbd5e1',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <CheckCircle size={14} /> Validate
        </button>

        <button
          onClick={onSave}
          title="Save Draft Graph"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            backgroundColor: '#111827',
            border: '1px solid #1e293b',
            color: '#cbd5e1',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Save size={14} /> Save
        </button>

        <button
          onClick={onPublish}
          title="Publish Immutable Version"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            color: '#f8fafc',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <UploadCloud size={14} /> Publish
        </button>

        <button
          onClick={onToggleExecution}
          title={isRunning ? 'Stop Live Execution' : 'Start Live Execution'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            backgroundColor: isRunning ? '#be123c' : '#059669',
            border: 'none',
            color: '#ffffff',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: isRunning
              ? '0 0 12px rgba(225, 29, 72, 0.4)'
              : '0 0 12px rgba(5, 150, 105, 0.4)',
          }}
        >
          {isRunning ? <Square size={14} /> : <Play size={14} />}
          {isRunning ? 'Stop Run' : 'Start Run'}
        </button>
      </div>
    </header>
  );
};
