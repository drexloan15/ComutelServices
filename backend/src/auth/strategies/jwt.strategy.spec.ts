import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { resetRuntimeConfigCacheForTests } from '../../config/runtime-config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test_access_secret_32_chars_minimum_0001';
    process.env.JWT_REFRESH_SECRET =
      'test_refresh_secret_32_chars_minimum_0001';
    process.env.BOOTSTRAP_ADMIN_SECRET =
      'test_bootstrap_secret_32_chars_min_0001';
    resetRuntimeConfigCacheForTests();
  });

  afterEach(() => {
    resetRuntimeConfigCacheForTests();
  });

  it('retorna payload normalizado para usuario activo', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: UserRole.ADMIN,
      isActive: true,
    });
    const strategy = new JwtStrategy(prismaMock as unknown as PrismaService);

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        role: UserRole.ADMIN,
      }),
    ).resolves.toEqual({
      sub: 'user-1',
      email: 'user@example.com',
      role: UserRole.ADMIN,
    });
  });

  it('rechaza usuario inactivo o inexistente', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const strategy = new JwtStrategy(prismaMock as unknown as PrismaService);

    await expect(
      strategy.validate({
        sub: 'missing',
        email: 'missing@example.com',
        role: UserRole.REQUESTER,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
