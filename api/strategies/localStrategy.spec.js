jest.mock('@librechat/data-schemas', () => ({
  getTenantId: jest.fn(),
  runAsSystem: jest.fn((fn) => fn()),
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@librechat/api', () => ({
  isEnabled: jest.fn(() => true),
  checkEmailConfig: jest.fn(() => false),
  comparePassword: jest.fn(),
}));

jest.mock('~/models', () => ({
  findUser: jest.fn(),
  findUsers: jest.fn(),
  updateUser: jest.fn(),
}));

const { getTenantId } = require('@librechat/data-schemas');
const { comparePassword } = require('@librechat/api');
const { findUser, findUsers } = require('~/models');
const { passportLogin } = require('./localStrategy');

const password = '12341234';

const createUser = (overrides = {}) => ({
  _id: 'user-1',
  email: 'teste1@teste.com',
  password: 'hashed',
  emailVerified: true,
  createdAt: new Date(),
  ...overrides,
});

const callLogin = (email = 'teste1@teste.com') =>
  new Promise((resolve, reject) => {
    passportLogin(
      { body: { email, password }, ip: '127.0.0.1' },
      email,
      password,
      (err, user, info) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({ user, info });
      },
    );
  });

describe('localStrategy tenant-aware login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ORQEST_TENANT_ID;
    delete process.env.LOCAL_TENANT_ID;
    comparePassword.mockResolvedValue(true);
  });

  it('uses pre-auth tenant context when looking up a local user', async () => {
    const user = createUser({ tenantId: 'local-teste' });
    getTenantId.mockReturnValue('local-teste');
    findUser.mockResolvedValue(user);

    const result = await callLogin();

    expect(findUser).toHaveBeenCalledWith(
      { email: 'teste1@teste.com', tenantId: 'local-teste' },
      '+password',
    );
    expect(findUsers).not.toHaveBeenCalled();
    expect(result).toEqual({ user, info: undefined });
  });

  it('rejects a disabled user before checking the password', async () => {
    getTenantId.mockReturnValue('local-teste');
    findUser.mockResolvedValue(createUser({ disabled: true, tenantId: 'local-teste' }));

    const result = await callLogin();

    expect(result).toEqual({ user: false, info: { message: 'Account disabled.' } });
    expect(comparePassword).not.toHaveBeenCalled();
  });

  it('uses ORQEST_TENANT_ID as local fallback when no pre-auth tenant is present', async () => {
    const user = createUser({ tenantId: 'local-teste' });
    process.env.ORQEST_TENANT_ID = 'local-teste';
    getTenantId.mockReturnValue(undefined);
    findUser.mockResolvedValue(user);

    const result = await callLogin();

    expect(findUser).toHaveBeenCalledWith(
      { email: 'teste1@teste.com', tenantId: 'local-teste' },
      '+password',
    );
    expect(findUsers).not.toHaveBeenCalled();
    expect(result).toEqual({ user, info: undefined });
  });

  it('does not pick an arbitrary user when email exists in multiple tenants without tenant context', async () => {
    getTenantId.mockReturnValue(undefined);
    findUsers.mockResolvedValue([
      createUser({ _id: 'user-1', tenantId: 'tenant-a' }),
      createUser({ _id: 'user-2', tenantId: 'tenant-b' }),
    ]);

    const result = await callLogin();

    expect(findUsers).toHaveBeenCalledWith({ email: 'teste1@teste.com' }, '+password', {
      limit: 2,
      sort: { createdAt: -1 },
    });
    expect(comparePassword).not.toHaveBeenCalled();
    expect(result).toEqual({
      user: false,
      info: { message: 'Tenant context required for this email.' },
    });
  });
});
