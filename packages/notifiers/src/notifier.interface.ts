export interface NotificationPayload {
  alertId: string;
  workflowId: string;
  deviceId: string;
  severity: string;
  title: string;
  channel: 'mock' | 'sms' | 'webhook' | 'email';
  recipients: string[];
  message: string;
}

export interface DeliveryAttempt {
  attemptNumber: number;
  timestamp: string;
  success: boolean;
  latencyMs: number;
  error?: string;
}

export interface DeliveryReceipt {
  id: string;
  alertId: string;
  channel: string;
  status: 'delivered' | 'failed' | 'dead_letter';
  attempts: DeliveryAttempt[];
}

export interface INotifier {
  readonly channel: string;
  send(payload: NotificationPayload): Promise<DeliveryReceipt>;
}
