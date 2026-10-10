import { WorkflowDefinition } from '@nexusflow/shared';
import { defaultValidator } from '../validator/index.js';
import { createOperator, IOperator, OperatorOutput, EngineMessage } from '../operators/index.js';
import { AlertEventPayload } from '../operators/DashboardAlertOperator.js';

export interface RouteTarget {
  targetNodeId: string;
  targetPortId: string;
}

export class ExecutionPlan {
  readonly workflowId: string;
  readonly sortedNodeIds: string[];
  readonly operators: Map<string, IOperator>;
  // Key format: `${sourceNodeId}:${sourcePortId}` -> RouteTarget[]
  readonly routes: Map<string, RouteTarget[]>;
  readonly inputNodeIds: string[];

  constructor(
    workflowId: string,
    sortedNodeIds: string[],
    operators: Map<string, IOperator>,
    routes: Map<string, RouteTarget[]>,
    inputNodeIds: string[]
  ) {
    this.workflowId = workflowId;
    this.sortedNodeIds = sortedNodeIds;
    this.operators = operators;
    this.routes = routes;
    this.inputNodeIds = inputNodeIds;
  }

  // Executes a single telemetry event through the graph deterministically
  execute(message: EngineMessage): {
    alerts: AlertEventPayload[];
    allOutputs: OperatorOutput[];
  } {
    const alerts: AlertEventPayload[] = [];
    const allOutputs: OperatorOutput[] = [];

    // Queue of pending messages: { targetNodeId, inputPortId, message }
    const pendingQueue: Array<{
      targetNodeId: string;
      inputPortId: string;
      message: EngineMessage;
    }> = [];

    // 1. Inject message into all input nodes (e.g., sensor-input)
    for (const inputNodeId of this.inputNodeIds) {
      pendingQueue.push({
        targetNodeId: inputNodeId,
        inputPortId: '',
        message,
      });
    }

    // 2. Propagate through the directed acyclic execution plan
    while (pendingQueue.length > 0) {
      const { targetNodeId, inputPortId, message: currentMsg } = pendingQueue.shift()!;
      const operator = this.operators.get(targetNodeId);
      if (!operator) continue;

      try {
        const outputs = operator.process(inputPortId, currentMsg);
        for (const out of outputs) {
          allOutputs.push(out);

          // Collect alerts from dashboard alert nodes
          if (operator.type === 'dashboard-alert' && out.portId === 'alertEvent') {
            alerts.push(out.message.value as AlertEventPayload);
          }

          // Route outputs to downstream connected target ports
          const routeKey = `${targetNodeId}:${out.portId}`;
          const targets = this.routes.get(routeKey) || [];

          for (const target of targets) {
            pendingQueue.push({
              targetNodeId: target.targetNodeId,
              inputPortId: target.targetPortId,
              message: out.message,
            });
          }
        }
      } catch (err) {
        console.error(`Error processing node '${targetNodeId}':`, err);
      }
    }

    return { alerts, allOutputs };
  }

  reset(): void {
    for (const operator of this.operators.values()) {
      operator.reset();
    }
  }
}

export class GraphCompiler {
  static compile(workflowId: string, workflow: WorkflowDefinition): ExecutionPlan {
    // 1. Strict validation
    const validation = defaultValidator.validate(workflow);
    if (!validation.valid) {
      throw new Error(
        `Cannot compile invalid workflow: ${validation.issues.map((i) => i.message).join('; ')}`
      );
    }

    const nodes = workflow.nodes;
    const edges = workflow.edges;

    // 2. Topological Sort using Kahn's Algorithm
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adj.set(node.id, []);
    }

    for (const edge of edges) {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      adj.get(edge.source)!.push(edge.target);
    }

    const queue: string[] = [];
    for (const [nodeId, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(nodeId);
      }
    }

    const sortedNodeIds: string[] = [];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      sortedNodeIds.push(curr);

      const neighbors = adj.get(curr) || [];
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (sortedNodeIds.length !== nodes.length) {
      throw new Error('Topological sort failed: graph has cycles');
    }

    // 3. Instantiate Operators
    const operators = new Map<string, IOperator>();
    const inputNodeIds: string[] = [];

    for (const node of nodes) {
      const op = createOperator(
        { workflowId, nodeId: node.id },
        node.type,
        node.config
      );
      operators.set(node.id, op);

      if (node.type === 'sensor-input') {
        inputNodeIds.push(node.id);
      }
    }

    // 4. Build routing table
    const routes = new Map<string, RouteTarget[]>();
    for (const edge of edges) {
      const key = `${edge.source}:${edge.sourcePort}`;
      let targets = routes.get(key);
      if (!targets) {
        targets = [];
        routes.set(key, targets);
      }
      targets.push({
        targetNodeId: edge.target,
        targetPortId: edge.targetPort,
      });
    }

    return new ExecutionPlan(
      workflowId,
      sortedNodeIds,
      operators,
      routes,
      inputNodeIds
    );
  }
}
