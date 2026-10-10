import { NodeTypeDefinition } from './types.js';
import {
  SensorInputNodeDef,
  MovingAverageNodeDef,
  WindowStatsNodeDef,
  ThresholdConditionNodeDef,
  ForDurationNodeDef,
  AbsenceHeartbeatNodeDef,
  BooleanLogicNodeDef,
  DashboardAlertNodeDef,
  NotifyNodeDef,
  LoggerNodeDef,
} from './nodes.js';
import { PortType } from '@nexusflow/shared';

export * from './types.js';
export * from './nodes.js';

class OperatorRegistry {
  private nodes: Map<string, NodeTypeDefinition<any>> = new Map();

  constructor() {
    this.register(SensorInputNodeDef);
    this.register(MovingAverageNodeDef);
    this.register(WindowStatsNodeDef);
    this.register(ThresholdConditionNodeDef);
    this.register(ForDurationNodeDef);
    this.register(AbsenceHeartbeatNodeDef);
    this.register(BooleanLogicNodeDef);
    this.register(DashboardAlertNodeDef);
    this.register(NotifyNodeDef);
    this.register(LoggerNodeDef);
  }

  register(def: NodeTypeDefinition<any>): void {
    this.nodes.set(def.type, def);
  }

  getNode(type: string): NodeTypeDefinition<any> | undefined {
    return this.nodes.get(type);
  }

  getAllNodes(): NodeTypeDefinition<any>[] {
    return Array.from(this.nodes.values());
  }

  arePortsCompatible(sourceType: PortType, targetType: PortType): boolean {
    return sourceType === targetType;
  }
}

export const registry = new OperatorRegistry();
