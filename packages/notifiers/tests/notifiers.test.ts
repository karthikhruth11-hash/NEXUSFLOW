import { describe, it, expect } from 'vitest';
import { MockNotifier, SmsNotifier, WebhookNotifier } from '../src/index.js';

describe('Notifier Adapters', () => {
  const samplePayload = {
    alertId: 'alt-test-01',
    workflowId: 'wf-test',
    deviceId: 'turbine-01',
    severity: 'critical',
    title: 'High Temp Alert',
    channel: 'mock' as const,
    recipients: ['admin@plant.com'],
    message: 'Test alert message',
  };

  it('MockNotifier records delivered notifications in memory', async () => {
    const notifier = new MockNotifier();
    const receipt = await notifier.send(samplePayload);

    expect(receipt.status).toBe('delivered');
    expect(receipt.attempts.length).toBe(1);
    expect(receipt.attempts[0].success).toBe(true);

    const sent = notifier.getSent();
    expect(sent.length).toBe(1);
    expect(sent[0].payload.alertId).toBe('alt-test-01');
  });

  it('SmsNotifier delivers receipt', async () => {
    const notifier = new SmsNotifier();
    const receipt = await notifier.send(samplePayload);

    expect(receipt.status).toBe('delivered');
    expect(receipt.channel).toBe('sms');
  });

  it('WebhookNotifier handles timeout / unreachable endpoint gracefully without crashing', async () => {
    const notifier = new WebhookNotifier({ maxRetries: 1, timeoutMs: 50 });
    const receipt = await notifier.send({
      ...samplePayload,
      recipients: ['http://127.0.0.1:9999/non-existent-webhook'],
    });

    expect(receipt.status).toBe('dead_letter');
    expect(receipt.attempts.length).toBe(1);
    expect(receipt.attempts[0].success).toBe(false);
  });
});
