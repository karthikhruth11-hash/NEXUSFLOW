import { INotifier, NotificationPayload, DeliveryReceipt } from './notifier.interface.js';

export class MockNotifier implements INotifier {
  readonly channel = 'mock';
  private sentNotifications: Array<{
    payload: NotificationPayload;
    receipt: DeliveryReceipt;
  }> = [];

  async send(payload: NotificationPayload): Promise<DeliveryReceipt> {
    const start = performance.now();
    const receipt: DeliveryReceipt = {
      id: `rcpt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      alertId: payload.alertId,
      channel: 'mock',
      status: 'delivered',
      attempts: [
        {
          attemptNumber: 1,
          timestamp: new Date().toISOString(),
          success: true,
          latencyMs: Math.round((performance.now() - start) * 100) / 100,
        },
      ],
    };

    this.sentNotifications.push({ payload, receipt });
    return receipt;
  }

  getSent(): Array<{ payload: NotificationPayload; receipt: DeliveryReceipt }> {
    return this.sentNotifications;
  }

  clear(): void {
    this.sentNotifications = [];
  }
}
