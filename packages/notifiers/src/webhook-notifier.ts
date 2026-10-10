import { INotifier, NotificationPayload, DeliveryReceipt, DeliveryAttempt } from './notifier.interface.js';

export class WebhookNotifier implements INotifier {
  readonly channel = 'webhook';
  private maxRetries: number;
  private timeoutMs: number;

  constructor(options: { maxRetries?: number; timeoutMs?: number } = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.timeoutMs = options.timeoutMs ?? 3000;
  }

  async send(payload: NotificationPayload): Promise<DeliveryReceipt> {
    const attempts: DeliveryAttempt[] = [];
    let isDelivered = false;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const start = performance.now();
      try {
        // Simulated or real fetch dispatch
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        // Dispatches to recipients (URLs)
        for (const url of payload.recipients) {
          if (url.startsWith('http://') || url.startsWith('https://')) {
            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
          }
        }
        clearTimeout(timeout);

        attempts.push({
          attemptNumber: attempt,
          timestamp: new Date().toISOString(),
          success: true,
          latencyMs: Math.round((performance.now() - start) * 100) / 100,
        });
        isDelivered = true;
        break;
      } catch (err: unknown) {
        attempts.push({
          attemptNumber: attempt,
          timestamp: new Date().toISOString(),
          success: false,
          latencyMs: Math.round((performance.now() - start) * 100) / 100,
          error: err instanceof Error ? err.message : String(err),
        });

        if (attempt < this.maxRetries) {
          // Bounded exponential backoff with jitter
          const delay = Math.min(1000, 100 * Math.pow(2, attempt) + Math.random() * 50);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    return {
      id: `rcpt-${Date.now()}`,
      alertId: payload.alertId,
      channel: 'webhook',
      status: isDelivered ? 'delivered' : 'dead_letter',
      attempts,
    };
  }
}
