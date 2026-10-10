import {
  WorkflowDefinition,
  GraphValidationResult,
  ValidationIssue,
} from '@nexusflow/shared';
import { registry, ValidationContext } from '../registry/index.js';

export interface ValidatorOptions {
  maxNodes?: number;
  maxEdges?: number;
  context?: ValidationContext;
}

export class GraphValidator {
  private maxNodes: number;
  private maxEdges: number;

  constructor(options: ValidatorOptions = {}) {
    this.maxNodes = options.maxNodes ?? 50;
    this.maxEdges = options.maxEdges ?? 100;
  }

  validate(
    workflow: WorkflowDefinition,
    context: ValidationContext = {}
  ): GraphValidationResult {
    const issues: ValidationIssue[] = [];
    const nodes = workflow.nodes || [];
    const edges = workflow.edges || [];

    // 1. Graph Size Limits
    if (nodes.length === 0) {
      issues.push({
        code: 'GRAPH_EMPTY',
        severity: 'error',
        message: 'Workflow graph must contain at least one node',
        fixHint: 'Drag a Sensor Input node onto the canvas',
      });
      return { valid: false, issues };
    }

    if (nodes.length > this.maxNodes) {
      issues.push({
        code: 'GRAPH_LIMITS_EXCEEDED',
        severity: 'error',
        message: `Graph has ${nodes.length} nodes, which exceeds maximum limit of ${this.maxNodes}`,
        fixHint: `Remove unnecessary nodes to stay within the ${this.maxNodes} node limit`,
      });
    }

    if (edges.length > this.maxEdges) {
      issues.push({
        code: 'GRAPH_LIMITS_EXCEEDED',
        severity: 'error',
        message: `Graph has ${edges.length} edges, which exceeds maximum limit of ${this.maxEdges}`,
        fixHint: `Remove excess connections to stay within ${this.maxEdges} edges`,
      });
    }

    // 2. Node ID Uniqueness
    const nodeMap = new Map<string, (typeof nodes)[0]>();
    for (const node of nodes) {
      if (nodeMap.has(node.id)) {
        issues.push({
          code: 'DUPLICATE_NODE_ID',
          severity: 'error',
          nodeId: node.id,
          message: `Duplicate node ID '${node.id}' detected in workflow`,
          fixHint: 'Ensure every node in the graph has a unique ID',
        });
      } else {
        nodeMap.set(node.id, node);
      }
    }

    // 3. Node Type & Configuration Validation
    for (const node of nodes) {
      const nodeDef = registry.getNode(node.type);
      if (!nodeDef) {
        issues.push({
          code: 'UNKNOWN_NODE_TYPE',
          severity: 'error',
          nodeId: node.id,
          message: `Unknown node type '${node.type}'`,
          fixHint: `Allowed types: ${registry.getAllNodes().map((n) => n.type).join(', ')}`,
        });
        continue;
      }

      // Validate node configuration against Zod schema
      const configResult = nodeDef.configSchema.safeParse(node.config || {});
      if (!configResult.success) {
        for (const issue of configResult.error.issues) {
          issues.push({
            code: 'MISSING_CONFIG',
            severity: 'error',
            nodeId: node.id,
            message: `Node '${node.label || node.id}' config error at '${issue.path.join('.')}': ${issue.message}`,
            fixHint: `Configure valid ${issue.path.join('.')} in node settings`,
          });
        }
      } else {
        // Run custom validator if available
        if (nodeDef.validateConfig) {
          const customIssues = nodeDef.validateConfig(configResult.data, context, node.id);
          issues.push(...customIssues);
        }
      }
    }

    // 4. Edge Validation & Port Compatibility
    const edgeKeySet = new Set<string>();
    const nodeIncomingEdges = new Map<string, number>();
    const nodeOutgoingEdges = new Map<string, number>();

    for (const node of nodes) {
      nodeIncomingEdges.set(node.id, 0);
      nodeOutgoingEdges.set(node.id, 0);
    }

    for (const edge of edges) {
      const edgeKey = `${edge.source}:${edge.sourcePort}->${edge.target}:${edge.targetPort}`;
      if (edgeKeySet.has(edgeKey)) {
        issues.push({
          code: 'DUPLICATE_EDGE',
          severity: 'error',
          edgeId: edge.id,
          message: `Duplicate connection from ${edge.source}:${edge.sourcePort} to ${edge.target}:${edge.targetPort}`,
          fixHint: 'Remove redundant duplicate edge',
        });
        continue;
      }
      edgeKeySet.add(edgeKey);

      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);

      // Check source and target existence
      if (!sourceNode) {
        issues.push({
          code: 'DANGLING_EDGE',
          severity: 'error',
          edgeId: edge.id,
          message: `Edge references non-existent source node '${edge.source}'`,
          fixHint: 'Reconnect or remove dangling edge',
        });
        continue;
      }

      if (!targetNode) {
        issues.push({
          code: 'DANGLING_EDGE',
          severity: 'error',
          edgeId: edge.id,
          message: `Edge references non-existent target node '${edge.target}'`,
          fixHint: 'Reconnect or remove dangling edge',
        });
        continue;
      }

      const sourceDef = registry.getNode(sourceNode.type);
      const targetDef = registry.getNode(targetNode.type);

      if (!sourceDef || !targetDef) {
        continue; // Already flagged as UNKNOWN_NODE_TYPE
      }

      // Check port existence and direction
      const sourcePort = sourceDef.outputs.find((p) => p.id === edge.sourcePort);
      const targetPort = targetDef.inputs.find((p) => p.id === edge.targetPort);

      if (!sourcePort) {
        issues.push({
          code: 'DANGLING_EDGE',
          severity: 'error',
          edgeId: edge.id,
          nodeId: sourceNode.id,
          message: `Source node '${sourceNode.id}' (${sourceNode.type}) has no output port '${edge.sourcePort}'`,
          fixHint: `Available output ports: ${sourceDef.outputs.map((p) => p.id).join(', ') || 'none'}`,
        });
      }

      if (!targetPort) {
        issues.push({
          code: 'DANGLING_EDGE',
          severity: 'error',
          edgeId: edge.id,
          nodeId: targetNode.id,
          message: `Target node '${targetNode.id}' (${targetNode.type}) has no input port '${edge.targetPort}'`,
          fixHint: `Available input ports: ${targetDef.inputs.map((p) => p.id).join(', ') || 'none'}`,
        });
      }

      // Type compatibility
      if (sourcePort && targetPort) {
        if (!registry.arePortsCompatible(sourcePort.type, targetPort.type)) {
          issues.push({
            code: 'INCOMPATIBLE_PORT_TYPES',
            severity: 'error',
            edgeId: edge.id,
            message: `Cannot connect '${sourcePort.type}' output from ${sourceNode.id} to '${targetPort.type}' input on ${targetNode.id}`,
            fixHint: `Ensure port types match (${sourcePort.type} cannot connect to ${targetPort.type})`,
          });
        }
      }

      nodeOutgoingEdges.set(edge.source, (nodeOutgoingEdges.get(edge.source) || 0) + 1);
      nodeIncomingEdges.set(edge.target, (nodeIncomingEdges.get(edge.target) || 0) + 1);
    }

    // 5. Orphaned & Unreachable Nodes Check
    for (const node of nodes) {
      const inCount = nodeIncomingEdges.get(node.id) || 0;
      const outCount = nodeOutgoingEdges.get(node.id) || 0;
      const nodeDef = registry.getNode(node.type);

      // Node with no connections at all
      if (inCount === 0 && outCount === 0 && nodes.length > 1) {
        issues.push({
          code: 'ORPHANED_NODE',
          severity: 'warning',
          nodeId: node.id,
          message: `Node '${node.label || node.id}' is disconnected from the workflow graph`,
          fixHint: 'Connect this node to other nodes or remove it',
        });
      } else if (nodeDef) {
        // Intermediate node requiring inputs has zero incoming edges
        if (nodeDef.inputs.length > 0 && inCount === 0) {
          issues.push({
            code: 'ORPHANED_NODE',
            severity: 'error',
            nodeId: node.id,
            message: `Node '${node.label || node.id}' (${node.type}) requires input but has no incoming connections`,
            fixHint: 'Connect an upstream node to this node',
          });
        }
      }
    }

    // 6. Cycle Detection (DAG check) using Kahn's Algorithm / DFS
    const cycleDetected = this.detectCycles(nodes, edges);
    if (cycleDetected) {
      issues.push({
        code: 'CYCLE_DETECTED',
        severity: 'error',
        nodeId: cycleDetected.nodeId,
        edgeId: cycleDetected.edgeId,
        message: `Cycle detected involving node '${cycleDetected.nodeId}'. Workflow graphs must be directed acyclic graphs (DAGs).`,
        fixHint: 'Remove the edge creating the closed loop/cycle',
      });
    }

    const hasErrors = issues.some((i) => i.severity === 'error');
    return {
      valid: !hasErrors,
      issues,
    };
  }

  private detectCycles(
    nodes: Array<{ id: string }>,
    edges: Array<{ id: string; source: string; target: string }>
  ): { nodeId?: string; edgeId?: string } | null {
    const adj = new Map<string, Array<{ target: string; edgeId: string }>>();
    for (const node of nodes) {
      adj.set(node.id, []);
    }
    for (const edge of edges) {
      if (adj.has(edge.source) && adj.has(edge.target)) {
        adj.get(edge.source)!.push({ target: edge.target, edgeId: edge.id });
      }
    }

    // 0 = unvisited, 1 = visiting (in current DFS stack), 2 = visited
    const visited = new Map<string, number>();
    for (const node of nodes) {
      visited.set(node.id, 0);
    }

    for (const node of nodes) {
      if (visited.get(node.id) === 0) {
        const cycle = this.dfsCycle(node.id, adj, visited);
        if (cycle) return cycle;
      }
    }

    return null;
  }

  private dfsCycle(
    current: string,
    adj: Map<string, Array<{ target: string; edgeId: string }>>,
    visited: Map<string, number>
  ): { nodeId: string; edgeId?: string } | null {
    visited.set(current, 1);

    const neighbors = adj.get(current) || [];
    for (const neighbor of neighbors) {
      const state = visited.get(neighbor.target);
      if (state === 1) {
        // Back edge found -> cycle!
        return { nodeId: current, edgeId: neighbor.edgeId };
      }
      if (state === 0) {
        const cycle = this.dfsCycle(neighbor.target, adj, visited);
        if (cycle) return cycle;
      }
    }

    visited.set(current, 2);
    return null;
  }
}

export const defaultValidator = new GraphValidator();
