import axios from 'axios';
import { executeTenantFunction } from './executor';
import type { TenantFunctionInput } from './types';
import type { TenantFunctionExecutorDeps } from './executor';

jest.mock('axios');

const mockedAxios = axios as unknown as jest.MockedFunction<typeof axios>;

function createFunction(overrides: Partial<TenantFunctionInput> = {}): TenantFunctionInput {
  return {
    tenantId: 'tenant-x',
    id: 'get_report',
    name: 'Get report',
    description: 'Gets a report',
    type: 'http',
    config: {
      baseUrl: 'https://api.example.com',
      method: 'GET',
      path: '/accounts/{accountId}/reports',
    },
    inputSchema: {},
    isActive: true,
    ...overrides,
  };
}

const getTenantSecret = jest.fn<
  ReturnType<TenantFunctionExecutorDeps['getTenantSecret']>,
  Parameters<TenantFunctionExecutorDeps['getTenantSecret']>
>(async () => ({
  name: 'api-token',
  tenantId: 'tenant-x',
  type: 'bearer' as const,
  value: 'secret-token',
}));

const deps: TenantFunctionExecutorDeps = {
  getTenantSecret,
};

describe('executeTenantFunction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.mockResolvedValue({
      status: 200,
      data: { rows: [1, 2] },
    });
  });

  it('sends non-path GET args as query params', async () => {
    const result = await executeTenantFunction(
      createFunction(),
      { accountId: 'act 1', since: '2026-01-01', limit: 10 },
      deps,
    );

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: 'https://api.example.com/accounts/act%201/reports',
        params: { since: '2026-01-01', limit: 10 },
        data: undefined,
      }),
    );
    expect(JSON.parse(result)).toEqual({
      ok: true,
      status: 200,
      data: { rows: [1, 2] },
    });
  });

  it('sends non-path POST args as JSON body', async () => {
    await executeTenantFunction(
      createFunction({
        config: {
          baseUrl: 'https://api.example.com',
          method: 'POST',
          path: '/accounts/{accountId}/reports',
        },
      }),
      { accountId: 'act_1', title: 'Weekly', filters: { active: true } },
      deps,
    );

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: 'https://api.example.com/accounts/act_1/reports',
        params: undefined,
        data: { title: 'Weekly', filters: { active: true } },
      }),
    );
  });

  it('injects configured auth headers', async () => {
    await executeTenantFunction(
      createFunction({
        config: {
          baseUrl: 'https://api.example.com',
          method: 'GET',
          path: '/reports',
          auth: {
            type: 'api_key',
            secretName: 'api-token',
            headerName: 'X-Orqest-Key',
          },
        },
      }),
      {},
      deps,
    );

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-Orqest-Key': 'secret-token' },
      }),
    );
  });

  it('returns structured errors for HTTP failures', async () => {
    mockedAxios.mockResolvedValueOnce({
      status: 404,
      data: { message: 'missing' },
    });

    const result = await executeTenantFunction(createFunction(), { accountId: 'act_1' }, deps);

    expect(JSON.parse(result)).toEqual({
      ok: false,
      status: 404,
      error: {
        message: 'HTTP 404',
        data: { message: 'missing' },
      },
    });
  });

  it('applies postProcess only to successful response data', async () => {
    const result = await executeTenantFunction(
      createFunction({
        postProcess: '(data) => ({ total: data.rows.length })',
      }),
      { accountId: 'act_1' },
      deps,
    );

    expect(JSON.parse(result)).toEqual({
      ok: true,
      status: 200,
      data: { total: 2 },
    });
  });

  it('returns structured errors when postProcess fails', async () => {
    const result = await executeTenantFunction(
      createFunction({
        postProcess: '() => { throw new Error("bad transform") }',
      }),
      { accountId: 'act_1' },
      deps,
    );

    expect(JSON.parse(result)).toEqual({
      ok: false,
      status: 200,
      error: {
        message: 'bad transform',
      },
    });
  });

  it('does not expose secret names when auth lookup fails', async () => {
    getTenantSecret.mockResolvedValueOnce(null);

    const result = await executeTenantFunction(
      createFunction({
        config: {
          baseUrl: 'https://api.example.com',
          method: 'GET',
          path: '/reports',
          auth: {
            type: 'bearer',
            secretName: 'sensitive-secret-name',
          },
        },
      }),
      {},
      deps,
    );

    expect(result).not.toContain('sensitive-secret-name');
    expect(JSON.parse(result)).toEqual({
      ok: false,
      error: {
        message: 'Configured secret not found',
      },
    });
  });
});
