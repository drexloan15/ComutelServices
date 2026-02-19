import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflectorMock = {
    getAllAndOverride: jest.fn(),
  };

  const executionContextMock = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    executionContextMock.switchToHttp.mockReturnValue({
      getRequest: () => ({}),
    });
  });

  it('permite acceso cuando no hay roles requeridos', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(undefined);
    const guard = new RolesGuard(reflectorMock as unknown as Reflector);

    expect(guard.canActivate(executionContextMock as never)).toBe(true);
  });

  it('bloquea si falta rol en request', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    executionContextMock.switchToHttp.mockReturnValue({
      getRequest: () => ({ user: undefined }),
    });
    const guard = new RolesGuard(reflectorMock as unknown as Reflector);

    expect(() => guard.canActivate(executionContextMock as never)).toThrow(
      ForbiddenException,
    );
  });

  it('bloquea si el rol no coincide', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    executionContextMock.switchToHttp.mockReturnValue({
      getRequest: () => ({ user: { role: UserRole.REQUESTER } }),
    });
    const guard = new RolesGuard(reflectorMock as unknown as Reflector);

    expect(() => guard.canActivate(executionContextMock as never)).toThrow(
      ForbiddenException,
    );
  });

  it('permite si el rol coincide', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([
      UserRole.ADMIN,
      UserRole.AGENT,
    ]);
    executionContextMock.switchToHttp.mockReturnValue({
      getRequest: () => ({ user: { role: UserRole.AGENT } }),
    });
    const guard = new RolesGuard(reflectorMock as unknown as Reflector);

    expect(guard.canActivate(executionContextMock as never)).toBe(true);
  });
});
