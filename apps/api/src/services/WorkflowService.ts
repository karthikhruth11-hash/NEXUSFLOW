import { getDb } from '../lib/db.js';
import { defaultValidator } from '@nexusflow/workflow-engine';
import {
  WorkflowDefinition,
  GraphValidationResult,
} from '@nexusflow/shared';

export interface WorkflowRecord {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  version: number;
  graph: WorkflowDefinition;
  status: 'draft' | 'active' | 'stopped';
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowVersionRecord {
  id: string;
  tenantId: string;
  workflowId: string;
  version: number;
  graph: WorkflowDefinition;
  publishedBy: string;
  changeSummary?: string;
  createdAt: string;
}

export class WorkflowService {
  static async createWorkflow(
    tenantId: string,
    id: string,
    name: string,
    graph: WorkflowDefinition,
    description?: string
  ): Promise<WorkflowRecord> {
    const db = getDb();
    const now = new Date().toISOString();

    const record: WorkflowRecord = {
      id,
      tenantId,
      name,
      description,
      version: 1,
      graph,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    await db.collection<WorkflowRecord>('workflows').updateOne(
      { tenantId, id },
      { $set: record },
      { upsert: true }
    );

    return record;
  }

  static async listWorkflows(tenantId: string): Promise<WorkflowRecord[]> {
    const db = getDb();
    return db.collection<WorkflowRecord>('workflows').find({ tenantId }).toArray();
  }

  static async getWorkflow(tenantId: string, id: string): Promise<WorkflowRecord | null> {
    const db = getDb();
    return db.collection<WorkflowRecord>('workflows').findOne({ tenantId, id });
  }

  static async updateWorkflow(
    tenantId: string,
    id: string,
    update: Partial<Pick<WorkflowRecord, 'name' | 'description' | 'graph' | 'status'>>
  ): Promise<WorkflowRecord | null> {
    const db = getDb();
    const now = new Date().toISOString();

    const updateDoc: Record<string, unknown> = {
      ...update,
      updatedAt: now,
    };

    const res = await db.collection<WorkflowRecord>('workflows').findOneAndUpdate(
      { tenantId, id },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );

    return res ?? null;
  }

  static validateWorkflowGraph(
    graph: WorkflowDefinition,
    authorizedDeviceIds?: string[]
  ): GraphValidationResult {
    return defaultValidator.validate(graph, {
      authorizedDeviceIds,
    });
  }

  static async publishWorkflow(
    tenantId: string,
    id: string,
    publishedBy: string = 'system',
    changeSummary: string = 'Published new workflow version'
  ): Promise<{ workflow: WorkflowRecord; publishedVersion: WorkflowVersionRecord }> {
    const workflow = await this.getWorkflow(tenantId, id);
    if (!workflow) {
      throw new Error(`Workflow '${id}' not found`);
    }

    // Strict validation gate before publishing
    const validation = this.validateWorkflowGraph(workflow.graph);
    if (!validation.valid) {
      const error = new Error('Cannot publish workflow with validation errors');
      (error as unknown as { statusCode: number; issues: unknown }).statusCode = 400;
      (error as unknown as { statusCode: number; issues: unknown }).issues = validation.issues;
      throw error;
    }

    const nextVersion = workflow.version + 1;
    const now = new Date().toISOString();

    const versionRecord: WorkflowVersionRecord = {
      id: `${id}-v${nextVersion}`,
      tenantId,
      workflowId: id,
      version: nextVersion,
      graph: workflow.graph,
      publishedBy,
      changeSummary,
      createdAt: now,
    };

    const db = getDb();
    // 1. Store immutable version snapshot
    await db.collection<WorkflowVersionRecord>('workflow_versions').insertOne(versionRecord);

    // 2. Update current active workflow version
    const updatedWorkflow = await this.updateWorkflow(tenantId, id, {
      status: 'active',
    });

    await db.collection<WorkflowRecord>('workflows').updateOne(
      { tenantId, id },
      { $set: { version: nextVersion, status: 'active', updatedAt: now } }
    );

    const reloaded = await this.getWorkflow(tenantId, id);

    return {
      workflow: reloaded || updatedWorkflow!,
      publishedVersion: versionRecord,
    };
  }

  static async listVersions(tenantId: string, workflowId: string): Promise<WorkflowVersionRecord[]> {
    const db = getDb();
    return db
      .collection<WorkflowVersionRecord>('workflow_versions')
      .find({ tenantId, workflowId })
      .sort({ version: -1 })
      .toArray();
  }

  static async getVersion(
    tenantId: string,
    workflowId: string,
    version: number
  ): Promise<WorkflowVersionRecord | null> {
    const db = getDb();
    return db
      .collection<WorkflowVersionRecord>('workflow_versions')
      .findOne({ tenantId, workflowId, version });
  }
}
