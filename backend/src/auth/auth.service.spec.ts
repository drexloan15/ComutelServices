import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { resetRuntimeConfigCacheForTests } from '../config/runtime-config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService hardening', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
  };
  const jwtMock = {
    verifyAsync: jest.fn(),
    signAsync: jest.fn(),
  };
  const auditMock = {
    log: jest.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test_access_secret_32_chars_minimum_0001';
    process.env.JWT_REFRESH_SECRET =
      'test_refresh_secret_32_chars_minimum_0001';
    process.env.BOOTSTRAP_ADMIN_SECRET =
      'test_bootstrap_secret_32_chars_min_0001';
    resetRuntimeConfigCacheForTests();

    service = new AuthService(
      prismaMock as unknown as PrismaService,
      jwtMock as unknown as JwtService,
      auditMock as unknown as AuditService,
    );
  });

  it('bloquea login de usuario inactivo', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'inactive@example.com',
      fullName: 'Inactive',
      role: UserRole.REQUESTER,
      passwordHash,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    });

    await expect(
      service.login({
        email: 'inactive@example.com',
        password: 'Password123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('bloquea refresh de usuario inactivo', async () => {
    jwtMock.verifyAsync.mockResolvedValue({
      sub: 'user-2',
      role: UserRole.AGENT,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'agent@example.com',
      fullName: 'Agent',
      role: UserRole.AGENT,
      refreshTokenHash: await bcrypt.hash('refresh-token-strong-value', 10),
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
      passwordHash: null,
    });

    await expect(
      service.refresh('refresh-token-strong-value'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('bloquea endpoint me para usuario inactivo', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-3',
      email: 'user3@example.com',
      fullName: 'User 3',
      role: UserRole.REQUESTER,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    });

    await expect(service.me('user-3')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
