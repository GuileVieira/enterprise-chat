const express = require('express');
const request = require('supertest');

jest.mock('@librechat/api', () => ({
  isEnabled: (value) => value === true || value === 'true',
}));

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock('~/server/middleware/requireJwtAuth', () => (req, res, next) => {
  const userId = req.get('x-user-id');
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  req.user = {
    id: userId,
    tenantId: req.get('x-tenant-id'),
  };
  next();
});

jest.mock('~/models', () => ({
  getSharedMessages: jest.fn(),
  createSharedLink: jest.fn(),
  updateSharedLink: jest.fn(),
  deleteSharedLink: jest.fn(),
  getSharedLinks: jest.fn(),
  getSharedLink: jest.fn(),
  createTenantSharedLink: jest.fn(),
  getTenantSharedMessages: jest.fn(),
}));

jest.mock('~/server/utils/import/fork', () => ({
  forkSharedConversation: jest.fn(),
}));

const db = require('~/models');
const { forkSharedConversation } = require('~/server/utils/import/fork');

describe('tenant conversation sharing routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/share', require('./share'));
  });

  test('creates a tenant-scoped share for the authenticated user tenant', async () => {
    db.createTenantSharedLink.mockResolvedValue({
      shareId: 'share-1',
      conversationId: 'conv-1',
      targetMessageId: 'msg-1',
    });

    const res = await request(app)
      .post('/api/share/tenant/conv-1')
      .set('x-user-id', 'owner-user')
      .set('x-tenant-id', 'tenant-a')
      .send({ targetMessageId: 'msg-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      shareId: 'share-1',
      conversationId: 'conv-1',
      targetMessageId: 'msg-1',
    });
    expect(db.createTenantSharedLink).toHaveBeenCalledWith(
      'owner-user',
      'tenant-a',
      'conv-1',
      'msg-1',
    );
  });

  test('blocks tenant share access when user is not authenticated', async () => {
    const res = await request(app).get('/api/share/tenant/share-1');

    expect(res.status).toBe(401);
    expect(db.getTenantSharedMessages).not.toHaveBeenCalled();
  });

  test('allows anonymous access only to selected artifact content', async () => {
    db.getSharedMessages.mockResolvedValue({
      shareId: 'share-1',
      title: 'Private conversation title',
      conversationId: 'anon-conv',
      messages: [
        {
          messageId: 'message-1',
          conversationId: 'anon-conv',
          text: [
            'private conversation text',
            ':::artifact{identifier="report" type="text/html" title="Report"}',
            '<h1>Public artifact</h1>',
            ':::',
          ].join('\n'),
        },
      ],
    });

    const res = await request(app).get(
      '/api/share/share-1/artifact/report_text%2Fhtml_report_original-message',
    );

    expect(res.status).toBe(200);
    expect(res.body.title).toBeUndefined();
    expect(res.body.createdAt).toBeUndefined();
    expect(res.body.messages[0].text).toContain('<h1>Public artifact</h1>');
    expect(res.body.messages[0].text).not.toContain('private conversation text');
  });

  test('returns a same-tenant share preview for authenticated users', async () => {
    db.getTenantSharedMessages.mockResolvedValue({
      shareId: 'share-1',
      title: 'Shared Conversation',
      conversationId: 'anon-conv',
      messages: [],
    });

    const res = await request(app)
      .get('/api/share/tenant/share-1')
      .set('x-user-id', 'recipient-user')
      .set('x-tenant-id', 'tenant-a');

    expect(res.status).toBe(200);
    expect(res.body.shareId).toBe('share-1');
    expect(db.getTenantSharedMessages).toHaveBeenCalledWith('share-1', 'tenant-a');
  });

  test('returns not found when tenant share is outside caller tenant', async () => {
    db.getTenantSharedMessages.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/share/tenant/share-1')
      .set('x-user-id', 'recipient-user')
      .set('x-tenant-id', 'tenant-b');

    expect(res.status).toBe(404);
    expect(db.getTenantSharedMessages).toHaveBeenCalledWith('share-1', 'tenant-b');
  });

  test('forks a same-tenant share into the requesting user account', async () => {
    forkSharedConversation.mockResolvedValue({
      conversation: { conversationId: 'forked-conv', user: 'recipient-user' },
      messages: [{ messageId: 'forked-msg', user: 'recipient-user' }],
    });

    const res = await request(app)
      .post('/api/share/tenant/share-1/fork')
      .set('x-user-id', 'recipient-user')
      .set('x-tenant-id', 'tenant-a')
      .send({ targetMessageId: 'msg-1' });

    expect(res.status).toBe(201);
    expect(res.body.conversation.conversationId).toBe('forked-conv');
    expect(forkSharedConversation).toHaveBeenCalledWith({
      shareId: 'share-1',
      requestUserId: 'recipient-user',
      tenantId: 'tenant-a',
      targetMessageId: 'msg-1',
      option: undefined,
    });
  });
});
