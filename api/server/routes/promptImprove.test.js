const express = require('express');
const request = require('supertest');

const mockImprovePromptText = jest.fn();

class MockPromptImproveError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

jest.mock('@librechat/api', () => ({
  improvePromptText: mockImprovePromptText,
  PromptImproveError: MockPromptImproveError,
}));

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, res, next) => {
    if (req.headers.authorization !== 'Bearer valid-token') {
      return res.status(401).send({ message: 'Unauthorized' });
    }
    req.user = { id: 'user-1' };
    next();
  },
}));

describe('Prompt Improve Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    const router = require('./promptImprove');
    app = express();
    app.use(express.json());
    app.use('/api/prompt', router);
  });

  it('rejects unauthenticated requests', async () => {
    const response = await request(app).post('/api/prompt/improve').send({
      text: 'write better prompt',
    });

    expect(response.status).toBe(401);
    expect(mockImprovePromptText).not.toHaveBeenCalled();
  });

  it('returns improved text for authenticated requests', async () => {
    mockImprovePromptText.mockResolvedValue({ improvedText: 'Better prompt', cached: false });

    const response = await request(app)
      .post('/api/prompt/improve')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: 'write better prompt' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ improvedText: 'Better prompt', cached: false });
    expect(mockImprovePromptText).toHaveBeenCalledWith({ text: 'write better prompt' });
  });

  it('returns controlled validation errors', async () => {
    mockImprovePromptText.mockRejectedValue(
      new MockPromptImproveError('Prompt too short.', 400, 'SHORT'),
    );

    const response = await request(app)
      .post('/api/prompt/improve')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: 'too short' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Prompt too short.', code: 'SHORT' });
  });
});
