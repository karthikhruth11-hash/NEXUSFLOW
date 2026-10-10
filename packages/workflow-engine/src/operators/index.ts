import { IOperator, OperatorContext } from './types.js';
import { SensorInputOperator } from './SensorInputOperator.js';
import { MovingAverageOperator } from './MovingAverageOperator.js';
import { WindowStatsOperator } from './WindowStatsOperator.js';
import { ThresholdConditionOperator } from './ThresholdConditionOperator.js';
import { ForDurationOperator } from './ForDurationOperator.js';
import { AbsenceHeartbeatOperator } from './AbsenceHeartbeatOperator.js';
import { BooleanLogicOperator } from './BooleanLogicOperator.js';
import { DashboardAlertOperator } from './DashboardAlertOperator.js';
import { NotifyOperator } from './NotifyOperator.js';
import { LoggerOperator } from './LoggerOperator.js';

export * from './types.js';
export * from './SensorInputOperator.js';
export * from './MovingAverageOperator.js';
export * from './WindowStatsOperator.js';
export * from './ThresholdConditionOperator.js';
export * from './ForDurationOperator.js';
export * from './AbsenceHeartbeatOperator.js';
export * from './BooleanLogicOperator.js';
export * from './DashboardAlertOperator.js';
export * from './NotifyOperator.js';
export * from './LoggerOperator.js';

export function createOperator(
  context: OperatorContext,
  type: string,
  config: any
): IOperator {
  switch (type) {
    case 'sensor-input':
      return new SensorInputOperator(context, config);
    case 'moving-average':
      return new MovingAverageOperator(context, config);
    case 'window-stats':
      return new WindowStatsOperator(context, config);
    case 'threshold-condition':
      return new ThresholdConditionOperator(context, config);
    case 'for-duration':
      return new ForDurationOperator(context, config);
    case 'absence-heartbeat':
      return new AbsenceHeartbeatOperator(context, config);
    case 'boolean-logic':
      return new BooleanLogicOperator(context, config);
    case 'dashboard-alert':
      return new DashboardAlertOperator(context, config);
    case 'notify':
      return new NotifyOperator(context, config);
    case 'logger':
      return new LoggerOperator(context, config);
    default:
      throw new Error(`Unsupported operator type: '${type}'`);
  }
}
