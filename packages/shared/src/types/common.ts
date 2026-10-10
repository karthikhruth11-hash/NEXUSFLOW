export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    correlationId?: string;
  };
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  checks: {
    database: {
      status: 'ok' | 'down';
      latencyMs?: number;
      message?: string;
    };
    memory: {
      status: 'ok' | 'degraded';
      heapUsedMb: number;
      heapTotalMb: number;
      rssMb: number;
    };
  };
}
