import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { resetRuntimeConfigCacheForTests } from '../config/runtime-config';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const authServiceMock = {
    register: jest.fn(),
    bootstrapAdmin: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    me: jest.fn(),
  };

  const responseMock = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };

  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test_access_secret_32_chars_minimum_0001';
    process.env.JWT_REFRESH_SECRET =
      'test_refresh_secret_32_chars_minimum_0001';
    process.env.BOOTSTRAP_ADMIN_SECRET =
      'test_bootstrap_secret_32_chars_min_0001';
    process.env.CORS_ORIGINS = 'http://localhost:3000';
    process.env.AUTH_REFRESH_COOKIE_ENABLED = 'false';
    resetRuntimeConfigCacheForTests();

    authServiceMock.login.mockResolvedValue({ refreshToken: 'refresh-next' });
    authServiceMock.refresh.mockResolvedValue({ refreshToken: 'refresh-next' });
    authServiceMock.logout.mockResolvedValue({ success: true });

    controller = new AuthController(authServiceMock as never);
  });

  afterEach(() => {
    resetRuntimeConfigCacheForTests();
  });

  it('usa refresh token del body cuando existe', async () => {
    const req = {
      headers: {},
      cookies: {
        comutel_refresh_token: 'cookie-token',
      },
    };

    await controller.refresh(
      { refreshToken: '  body-token  ' },
      req as never,
      responseMock as never,
    );

    expect(authServiceMock.refresh).toHaveBeenCalledWith('body-token', req);
  });

  it('usa refresh token de cookie cuando body esta vacio y cookie esta habilitada', async () => {
    process.env.AUTH_REFRESH_COOKIE_ENABLED = 'true';
    process.env.CORS_ORIGINS = 'http://frontend.local';
    resetRuntimeConfigCacheForTests();

    const req = {
      headers: { origin: 'http://frontend.local' },
      cookies: {
        comutel_refresh_token: '  cookie-token  ',
      },
    };

    await controller.refresh({}, req as never, responseMock as never);

    expect(authServiceMock.refresh).toHaveBeenCalledWith('cookie-token', req);
    expect(responseMock.cookie).toHaveBeenCalled();
  });

  it('rechaza refresh sin token si cookie esta deshabilitada', async () => {
    const req = {
      headers: {},
      cookies: {},
    };

    await expect(
      controller.refresh({}, req as never, responseMock as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza origen no permitido cuando cookie de sesion esta habilitada', async () => {
    process.env.AUTH_REFRESH_COOKIE_ENABLED = 'true';
    process.env.CORS_ORIGINS = 'http://frontend.local';
    resetRuntimeConfigCacheForTests();

    const req = {
      headers: { origin: 'http://evil.local' },
    };

    await expect(
      controller.login(
        { email: 'user@example.com', password: 'Password123!' },
        req as never,
        responseMock as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logout limpia cookie y delega en servicio', async () => {
    process.env.AUTH_REFRESH_COOKIE_ENABLED = 'true';
    resetRuntimeConfigCacheForTests();

    const req = {
      headers: {},
    };
    const currentUser = {
      sub: 'user-1',
      email: 'user@example.com',
      role: UserRole.REQUESTER,
    };

    await controller.logout(currentUser, req as never, responseMock as never);

    expect(responseMock.clearCookie).toHaveBeenCalled();
    expect(authServiceMock.logout).toHaveBeenCalledWith('user-1', req);
  });
});
