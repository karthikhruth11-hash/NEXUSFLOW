import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { WorkflowService } from '../services/WorkflowService.js';
import { TelemetryService } from '../services/TelemetryService.js';
import { RuntimeManager } from '../services/RuntimeManager.js';
import { DeterministicReplayEngine } from '@nexusflow/workflow-engine';
import { WorkflowDefinitionSchema, ApiResponse } from '@nexusflow/shared';

export const workflowsRouter = Router();

const CreateWorkflowBodySchema = z.object({
  id: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().optional(),
  tenantId: z.string().trim().default('default-tenant'),
  graph: WorkflowDefinitionSchema,
});

const UpdateWorkflowBodySchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  description: z.string().trim().optional(),
  graph: WorkflowDefinitionSchema.optional(),
  status: z.enum(['draft', 'active', 'stopped']).optional(),
});

const PublishWorkflowBodySchema = z.object({
  publishedBy: z.string().trim().default('user-operator'),
  changeSummary: z.string().trim().optional(),
});

// Standalone graph validation endpoint
workflowsRouter.post('/api/workflows/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const graph = WorkflowDefinitionSchema.parse(req.body);

    const result = WorkflowService.validateWorkflowGraph(graph);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// Create workflow
workflowsRouter.post('/api/workflows', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const body = CreateWorkflowBodySchema.parse(req.body);

    const record = await WorkflowService.createWorkflow(
      body.tenantId,
      body.id,
      body.name,
      body.graph,
      body.description
    );

    const response: ApiResponse<typeof record> = {
      success: true,
      data: record,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    };

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

// List workflows
workflowsRouter.get('/api/workflows', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const tenantId = (req.query.tenantId as string) || 'default-tenant';

    const workflows = await WorkflowService.listWorkflows(tenantId);

    const response: ApiResponse<typeof workflows> = {
      success: true,
      data: workflows,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// Get workflow by ID
workflowsRouter.get('/api/workflows/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const tenantId = (req.query.tenantId as string) || 'default-tenant';
    const id = req.params.id;

    const workflow = await WorkflowService.getWorkflow(tenantId, id);
    if (!workflow) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow '${id}' does not exist`,
        },
      });
      return;
    }

    const response: ApiResponse<typeof workflow> = {
      success: true,
      data: workflow,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// Update draft workflow
workflowsRouter.put('/api/workflows/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const tenantId = (req.query.tenantId as string) || 'default-tenant';
    const id = req.params.id;
    const body = UpdateWorkflowBodySchema.parse(req.body);

    const updated = await WorkflowService.updateWorkflow(tenantId, id, body);
    if (!updated) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow '${id}' does not exist`,
        },
      });
      return;
    }

    const response: ApiResponse<typeof updated> = {
      success: true,
      data: updated,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// Validate specific saved workflow
workflowsRouter.post('/api/workflows/:id/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const tenantId = (req.query.tenantId as string) || 'default-tenant';
    const id = req.params.id;

    const workflow = await WorkflowService.getWorkflow(tenantId, id);
    if (!workflow) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow '${id}' does not exist`,
        },
      });
      return;
    }

    const result = WorkflowService.validateWorkflowGraph(workflow.graph);

    res.status(200).json({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Publish workflow (creates immutable version)
workflowsRouter.post('/api/workflows/:id/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const tenantId = (req.query.tenantId as string) || 'default-tenant';
    const id = req.params.id;
    const body = PublishWorkflowBodySchema.parse(req.body || {});

    const result = await WorkflowService.publishWorkflow(
      tenantId,
      id,
      body.publishedBy,
      body.changeSummary
    );

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    };

    res.status(200).json(response);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err && 'issues' in err) {
      const custom = err as { statusCode: number; message: string; issues: unknown };
      res.status(custom.statusCode).json({
        success: false,
        error: {
          code: 'WORKFLOW_VALIDATION_FAILED',
          message: custom.message,
          details: custom.issues,
        },
      });
      return;
    }
    next(err);
  }
});

// List immutable versions for workflow
workflowsRouter.get('/api/workflows/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const tenantId = (req.query.tenantId as string) || 'default-tenant';
    const id = req.params.id;

    const versions = await WorkflowService.listVersions(tenantId, id);

    const response: ApiResponse<typeof versions> = {
      success: true,
      data: versions,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// Get specific immutable version
workflowsRouter.get('/api/workflows/:id/versions/:version', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const tenantId = (req.query.tenantId as string) || 'default-tenant';
    const id = req.params.id;
    const versionNum = parseInt(req.params.version, 10);

    const versionDoc = await WorkflowService.getVersion(tenantId, id, versionNum);
    if (!versionDoc) {
      res.status(404).json({
        success: false,
        error: {
          code: 'VERSION_NOT_FOUND',
          message: `Version ${versionNum} for workflow '${id}' does not exist`,
        },
      });
      return;
    }

    const response: ApiResponse<typeof versionDoc> = {
      success: true,
      data: versionDoc,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// Replay/backtest workflow against historical telemetry
workflowsRouter.post('/api/workflows/:id/replay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const tenantId = (req.query.tenantId as string) || 'default-tenant';
    const id = req.params.id;

    const workflow = await WorkflowService.getWorkflow(tenantId, id);
    if (!workflow) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow '${id}' does not exist`,
        },
      });
      return;
    }

    const deviceId = (req.body?.deviceId || req.query?.deviceId) as string;
    if (!deviceId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DEVICE_ID',
          message: 'deviceId is required for replay',
        },
      });
      return;
    }

    const from = req.body?.from || (req.query?.from as string | undefined);
    const to = req.body?.to || (req.query?.to as string | undefined);
    const limit = req.body?.limit || (req.query?.limit ? parseInt(req.query.limit as string, 10) : 500);

    // Fetch historical telemetry
    const history = await TelemetryService.queryHistorical(tenantId, deviceId, from, to, limit);

    // Telemetry documents returned in descending order; reverse to chronological event order for replay
    const chronologicalTelemetry = history.reverse();

    // Run deterministic replay
    const replayResult = DeterministicReplayEngine.run(id, workflow.graph, chronologicalTelemetry);

    const response: ApiResponse<typeof replayResult> = {
      success: true,
      data: replayResult,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// Start workflow execution against live telemetry
workflowsRouter.post('/api/workflows/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const tenantId = (req.query.tenantId as string) || 'default-tenant';
    const id = req.params.id;

    const record = await RuntimeManager.startWorkflow(tenantId, id);

    res.status(200).json({
      success: true,
      data: record,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Stop workflow execution
workflowsRouter.post('/api/workflows/:id/stop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const tenantId = (req.query.tenantId as string) || 'default-tenant';
    const id = req.params.id;

    await RuntimeManager.stopWorkflow(tenantId, id);

    res.status(200).json({
      success: true,
      data: { id, status: 'stopped' },
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Get workflow execution status and metrics
workflowsRouter.get('/api/workflows/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const id = req.params.id;

    const runtime = RuntimeManager.getRuntime(id);
    const isActive = RuntimeManager.isWorkflowActive(id);

    res.status(200).json({
      success: true,
      data: {
        workflowId: id,
        active: isActive,
        status: runtime ? runtime.getStatus() : 'stopped',
        metrics: runtime ? runtime.getMetrics() : null,
      },
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    });
  } catch (err) {
    next(err);
  }
});
