import mongoose from 'mongoose';
import type { RequestHandler } from 'express';
import type { IntegrationReaders } from './reads';
import type { IntegrationRequest } from './contracts';
import { extractStoredMessageContent } from '../protection/adapters/submissions';
import { resolveConversationTitle } from '../protection/title';
import { inspectContentWithTraversal } from '../protection/runtime';
import {
  assertQuery,
  integrationHandler,
  invalid,
  notFound,
  paginate,
  paginationCursor,
  scalar,
} from './contracts';
interface Conversation {
  conversationId: string;
  title: string;
  projectId?: string;
  agent_id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
interface Message {
  messageId: string;
  conversationId: string;
  parentMessageId?: string;
  sender?: string;
  text?: string;
  isCreatedByUser?: boolean;
  createdAt?: Date;
  content?: Array<{ type?: string; text?: string | { value?: string }; think?: string }>;
}
function historyBoundary(
  req: IntegrationRequest,
  field: 'conversationId' | 'messageId',
  selection: object = {},
): object {
  const { after } = paginationCursor(req, selection);
  if (!after) return {};
  const dateText = after.slice(0, 24);
  const id = after.slice(25);
  const date = new Date(dateText);
  if (
    after[24] !== ':' ||
    !id ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString() !== dateText
  )
    throw invalid();
  return { $or: [{ createdAt: { $gt: date } }, { createdAt: date, [field]: { $gt: id } }] };
}
export function createIntegrationHistory(readers: IntegrationReaders): {
  handlers: { conversations: RequestHandler; messages: RequestHandler };
} {
  async function conversations(req: IntegrationRequest) {
    const projectId = scalar(req.query.projectId);
    const agentId = scalar(req.query.agentId);
    if (projectId) await readers.project(req, projectId);
    if (agentId) await readers.agent(req, agentId);
    const rows = await mongoose.models.Conversation.find({
      user: req.user.id,
      tenantId: req.user.tenantId,
      ...(projectId ? { projectId } : {}),
      ...(agentId ? { agent_id: agentId } : {}),
      ...historyBoundary(req, 'conversationId', { projectId, agentId }),
    })
      .sort({ createdAt: 1, conversationId: 1 })
      .limit(paginationCursor(req, { projectId, agentId }).limit + 1)
      .select('conversationId title projectId agent_id createdAt updatedAt')
      .lean<Conversation[]>();
    const output = [];
    for (const row of rows) {
      const references: { projectId?: string; agentId?: string } = {};
      if (row.projectId) {
        try {
          await readers.project(req, row.projectId);
          references.projectId = row.projectId;
        } catch (error) {
          if (!(error instanceof Error && 'status' in error && error.status === 404)) throw error;
        }
      }
      if (row.agent_id) {
        try {
          await readers.agent(req, row.agent_id);
          references.agentId = row.agent_id;
        } catch (error) {
          if (
            !(
              error instanceof Error &&
              'status' in error &&
              [403, 404].includes(Number(error.status))
            )
          )
            throw error;
        }
      }
      output.push({
        id: row.conversationId,
        title:
          resolveConversationTitle({ candidate: row.title, filters: req.config?.filters }) ?? '',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        ...references,
      });
    }
    return output;
  }
  async function messages(req: IntegrationRequest) {
    const convo = await mongoose.models.Conversation.exists({
      conversationId: req.params.id,
      user: req.user.id,
      tenantId: req.user.tenantId,
    });
    if (!convo) throw notFound();
    const rows = await mongoose.models.Message.find({
      conversationId: req.params.id,
      user: req.user.id,
      tenantId: req.user.tenantId,
      ...historyBoundary(req, 'messageId'),
    })
      .sort({ createdAt: 1, messageId: 1 })
      .limit(paginationCursor(req).limit + 1)
      .select(
        'messageId conversationId parentMessageId sender text isCreatedByUser content createdAt',
      )
      .lean<Message[]>();
    const parentIds = rows.flatMap((row) => (row.parentMessageId ? [row.parentMessageId] : []));
    const parents = await mongoose.models.Message.find({
      tenantId: req.user.tenantId,
      user: req.user.id,
      conversationId: req.params.id,
      messageId: { $in: parentIds },
    })
      .select('messageId')
      .lean<Array<{ messageId: string }>>();
    const authorizedParents = new Set(parents.map((row) => row.messageId));
    return rows.map((row) => {
      const content = (row.content ?? []).flatMap((part) => {
        if (part.type !== 'text') return [];
        const text = typeof part.text === 'string' ? part.text : part.text?.value;
        return text !== undefined ? [{ type: 'text' as const, text }] : [];
      });
      const projected = {
        id: row.messageId,
        conversationId: row.conversationId,
        parentMessageId:
          row.parentMessageId && authorizedParents.has(row.parentMessageId)
            ? row.parentMessageId
            : undefined,
        role: row.isCreatedByUser ? 'user' : 'assistant',
        text: row.text ?? '',
        content,
        createdAt: row.createdAt,
        omittedParts: (row.content?.length ?? 0) - content.length,
      };
      const inspection = inspectContentWithTraversal(
        () =>
          extractStoredMessageContent({
            text: projected.text,
            content: projected.content,
          }),
        { filters: req.config?.filters },
      );
      if (inspection.finding || inspection.traversalError)
        return { ...projected, text: '', content: [], contentFilterBlocked: true };
      return projected;
    });
  }
  return {
    handlers: {
      conversations: integrationHandler(async (req) => {
        assertQuery(req, ['projectId', 'agentId']);
        return paginate(
          req,
          await conversations(req),
          (row) => `${row.createdAt?.toISOString() ?? ''}:${row.id}`,
          { projectId: req.query.projectId, agentId: req.query.agentId },
        );
      }),
      messages: integrationHandler(async (req) => {
        assertQuery(req);
        return paginate(
          req,
          await messages(req),
          (row) => `${row.createdAt?.toISOString() ?? ''}:${row.id}`,
        );
      }),
    },
  };
}
