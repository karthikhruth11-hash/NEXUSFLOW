import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
} from '@xyflow/react';
import { Header } from './components/Header.js';
import { Palette } from './components/Palette.js';
import { ConfigPanel } from './components/ConfigPanel.js';
import { CustomNode } from './components/CustomNode.js';
import { AlertsView } from './components/AlertsView.js';
import { SimulatorView } from './components/SimulatorView.js';
import { useNexusSocket } from './hooks/useNexusSocket.js';
import { CheckCircle2, AlertOctagon, X } from 'lucide-react';

const initialNodes: Node[] = [
  {
    id: 'node-sensor',
    type: 'custom',
    position: { x: 80, y: 150 },
    data: {
      type: 'sensor-input',
      label: 'Turbine Sensor',
      config: { deviceId: 'turbine-01', measurement: 'temperature', unit: 'celsius' },
    },
  },
  {
    id: 'node-avg',
    type: 'custom',
    position: { x: 360, y: 150 },
    data: {
      type: 'moving-average',
      label: 'Moving Average (5 samples)',
      config: { mode: 'count', size: 5, minSamples: 3 },
    },
  },
  {
    id: 'node-thresh',
    type: 'custom',
    position: { x: 640, y: 150 },
    data: {
      type: 'threshold-condition',
      label: 'Threshold (> 80°C, clear 75°C)',
      config: { operator: '>', threshold: 80.0, hysteresis: 75.0 },
    },
  },
  {
    id: 'node-alert',
    type: 'custom',
    position: { x: 920, y: 150 },
    data: {
      type: 'dashboard-alert',
      label: 'Dashboard Alert',
      config: { severity: 'critical', title: 'Turbine Overheat Danger', cooldownSeconds: 60 },
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'node-sensor', sourceHandle: 'value', target: 'node-avg', targetHandle: 'input' },
  { id: 'e2', source: 'node-avg', sourceHandle: 'output', target: 'node-thresh', targetHandle: 'input' },
  { id: 'e3', source: 'node-thresh', sourceHandle: 'output', target: 'node-alert', targetHandle: 'trigger' },
];

export function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'canvas' | 'alerts' | 'simulator'>('canvas');
  const [workflowId] = useState('wf-turbine-mvp');
  const [workflowName, setWorkflowName] = useState('Industrial Turbine Overheat Protection');
  const [version, setVersion] = useState(2);
  const [status, setStatus] = useState('active');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  const {
    connected: wsConnected,
    liveTelemetry,
    alerts,
    nodeLiveValues,
    acknowledgeAlert,
    resolveAlert,
  } = useNexusSocket();

  // Load workflow on mount
  useEffect(() => {
    fetch(`/api/workflows/${workflowId}?tenantId=factory-1`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          const wf = json.data;
          setWorkflowName(wf.name);
          setVersion(wf.version);
          setStatus(wf.status);
          if (wf.graph?.nodes && wf.graph.nodes.length > 0) {
            setNodes(
              wf.graph.nodes.map((n: any) => ({
                id: n.id,
                type: 'custom',
                position: n.position,
                data: {
                  type: n.type,
                  label: n.label || n.type,
                  config: n.config,
                },
              }))
            );
          }
          if (wf.graph?.edges && wf.graph.edges.length > 0) {
            setEdges(
              wf.graph.edges.map((e: any) => ({
                id: e.id,
                source: e.source,
                sourceHandle: e.sourcePort,
                target: e.target,
                targetHandle: e.targetPort,
              }))
            );
          }
        }
      })
      .catch(console.error);
  }, [workflowId, setNodes, setEdges]);

  // Inject live values into nodes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const val = nodeLiveValues[node.id];
        if (val !== undefined) {
          return {
            ...node,
            data: { ...node.data, liveValue: val },
          };
        }
        return node;
      })
    );
  }, [nodeLiveValues, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleAddNode = (type: string, label: string) => {
    const id = `node-${Date.now()}`;
    const newNode: Node = {
      id,
      type: 'custom',
      position: { x: 300 + Math.random() * 80, y: 200 + Math.random() * 80 },
      data: {
        type,
        label,
        config: {},
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(id);
  };

  const handleUpdateNodeConfig = (nodeId: string, label: string, config: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label, config } } : n))
    );
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeId(null);
  };

  const getGraphJson = () => ({
    schemaVersion: '1.0.0',
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      label: n.data.label,
      position: n.position,
      config: n.data.config || {},
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      sourcePort: e.sourceHandle || 'output',
      target: e.target,
      targetPort: e.targetHandle || 'input',
    })),
    settings: {
      cooldownSeconds: 60,
      maxLatenessSeconds: 60,
      deviceIds: ['turbine-01', 'turbine-02'],
    },
  });

  const handleValidate = async () => {
    const graph = getGraphJson();
    const res = await fetch('/api/workflows/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(graph),
    });
    const json = await res.json();
    setValidationResult(json.data);
    setShowValidationModal(true);
  };

  const handleSave = async () => {
    const graph = getGraphJson();
    await fetch(`/api/workflows/${workflowId}?tenantId=factory-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph }),
    });
    setNotificationMsg('Draft saved successfully');
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const handlePublish = async () => {
    const res = await fetch(`/api/workflows/${workflowId}/publish?tenantId=factory-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publishedBy: 'factory-operator' }),
    });
    const json = await res.json();
    if (json.success) {
      setVersion(json.data.workflow.version);
      setStatus('active');
      setNotificationMsg(`Published Version ${json.data.workflow.version}!`);
      setTimeout(() => setNotificationMsg(null), 3000);
    } else {
      setValidationResult({ valid: false, issues: json.error?.details || [] });
      setShowValidationModal(true);
    }
  };

  const handleToggleExecution = async () => {
    if (status === 'active') {
      await fetch(`/api/workflows/${workflowId}/stop?tenantId=factory-1`, { method: 'POST' });
      setStatus('stopped');
    } else {
      await fetch(`/api/workflows/${workflowId}/start?tenantId=factory-1`, { method: 'POST' });
      setStatus('active');
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <Header
        workflowName={workflowName}
        version={version}
        status={status}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onValidate={handleValidate}
        onSave={handleSave}
        onPublish={handlePublish}
        onToggleExecution={handleToggleExecution}
        isRunning={status === 'active'}
        wsConnected={wsConnected}
        alertCount={alerts.filter((a) => a.state === 'FIRING').length}
      />

      {/* Notification Toast */}
      {notificationMsg && (
        <div
          style={{
            position: 'fixed',
            top: 70,
            right: 20,
            zIndex: 100,
            backgroundColor: '#064e3b',
            color: '#34d399',
            padding: '10px 16px',
            borderRadius: 6,
            border: '1px solid #059669',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          {notificationMsg}
        </div>
      )}

      {/* Content based on Active Tab */}
      {activeTab === 'canvas' && (
        <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 56px)', position: 'relative' }}>
          <Palette onAddNode={handleAddNode} />

          <div style={{ flex: 1, height: '100%' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_e, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              nodeTypes={nodeTypes}
              fitView
            >
              <Background />
              <Controls />
              <MiniMap
                nodeColor="#0284c7"
                maskColor="rgba(9, 13, 22, 0.8)"
                style={{ backgroundColor: '#0b1120', border: '1px solid #1e293b' }}
              />
            </ReactFlow>
          </div>

          {selectedNode && (
            <ConfigPanel
              node={selectedNode}
              onUpdateConfig={handleUpdateNodeConfig}
              onDeleteNode={handleDeleteNode}
              onClose={() => setSelectedNodeId(null)}
            />
          )}
        </div>
      )}

      {activeTab === 'alerts' && (
        <AlertsView alerts={alerts} onAcknowledge={acknowledgeAlert} onResolve={resolveAlert} />
      )}

      {activeTab === 'simulator' && <SimulatorView latestTelemetry={liveTelemetry} />}

      {/* Validation Modal */}
      {showValidationModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
        >
          <div
            style={{
              width: 500,
              backgroundColor: '#111827',
              borderRadius: 8,
              border: '1px solid #1e293b',
              padding: 20,
              color: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                {validationResult?.valid ? (
                  <>
                    <CheckCircle2 className="text-emerald-500" /> Graph Validation Passed
                  </>
                ) : (
                  <>
                    <AlertOctagon className="text-rose-500" /> Validation Issues Found
                  </>
                )}
              </h2>
              <button
                onClick={() => setShowValidationModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {validationResult?.valid ? (
              <p style={{ fontSize: 13, color: '#94a3b8' }}>
                All nodes, port type connections, and DAG cycles validated successfully. This graph is ready for execution.
              </p>
            ) : (
              <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                {validationResult?.issues?.map((issue: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      padding: 10,
                      backgroundColor: '#1e293b',
                      borderRadius: 6,
                      marginBottom: 8,
                      borderLeft: `4px solid ${issue.severity === 'error' ? '#f43f5e' : '#f59e0b'}`,
                    }}
                  >
                    <strong style={{ fontSize: 12, color: issue.severity === 'error' ? '#f43f5e' : '#f59e0b' }}>
                      [{issue.code}]
                    </strong>
                    <div style={{ fontSize: 12, marginTop: 2 }}>{issue.message}</div>
                    {issue.fixHint && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                        Fix: {issue.fixHint}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button
                onClick={() => setShowValidationModal(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#06b6d4',
                  color: '#090d16',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
