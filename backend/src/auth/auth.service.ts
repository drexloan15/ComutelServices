import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditAction, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types/jwt-payload.type';
import { AuditMetadata } from '../audit/audit.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterDto, request?: { ip?: string; headers?: Record<string, unknown> }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('El correo ya esta registrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const fullName = dto.fullName ?? dto.email.split('@')[0];

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName,
        role: UserRole.REQUESTER,
        passwordHash,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);
    await this.auditService.log({
      actorUserId: user.id,
      action: AuditAction.AUTH_REGISTER,
      resource: 'user',
      resourceId: user.id,
      details: { email: user.email, role: user.role },
      metadata: this.getMetadata(request),
    });

    return {
      user: this.toPublicUser(user),
      ...tokens,
    };
  }

  async bootstrapAdmin(dto: BootstrapAdminDto, request?: { ip?: string; headers?: Record<string, unknown> }) {
    const expectedSecret = process.env.BOOTSTRAP_ADMIN_SECRET;
    if (!expectedSecret || dto.bootstrapSecret !== expectedSecret) {
      throw new UnauthorizedException('Bootstrap secret invalido');
    }

    const adminCount = await this.prisma.user.count({
      where: { role: UserRole.ADMIN },
    });
    if (adminCount > 0) {
      throw new ConflictException('Ya existe un usuario ADMIN');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('El correo ya esta registrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        role: UserRole.ADMIN,
        passwordHash,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);
    await this.auditService.log({
      actorUserId: user.id,
      action: AuditAction.AUTH_BOOTSTRAP_ADMIN,
      resource: 'user',
      resourceId: user.id,
      details: { email: user.email, role: user.role },
      metadata: this.getMetadata(request),
    });

    return {
      user: this.toPublicUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto, request?: { ip?: string; headers?: Record<string, unknown> }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.auditService.log({
      actorUserId: user.id,
      action: AuditAction.AUTH_LOGIN,
      resource: 'user',
      resourceId: user.id,
      details: { email: user.email, role: user.role },
      metadata: this.getMetadata(request),
    });

    return {
      user: this.toPublicUser(user),
      ...tokens,
    };
  }

  async refresh(refreshToken: string, request?: { ip?: string; headers?: Record<string, unknown> }) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret',
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalido');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Sesion no valida');
    }

    const refreshValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!refreshValid) {
      throw new UnauthorizedException('Refresh token invalido');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);
    await this.auditService.log({
      actorUserId: user.id,
      action: AuditAction.AUTH_REFRESH,
      resource: 'user',
      resourceId: user.id,
      details: { email: user.email, role: user.role },
      metadata: this.getMetadata(request),
    });

    return {
      user: this.toPublicUser(user),
      ...tokens,
    };
  }

  async logout(userId: string, request?: { ip?: string; headers?: Record<string, unknown> }) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    await this.auditService.log({
      actorUserId: userId,
      action: AuditAction.AUTH_LOGOUT,
      resource: 'user',
      resourceId: userId,
      details: { logout: true },
      metadata: this.getMetadata(request),
    });

    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return this.toPublicUser(user);
  }

  private async generateTokens(userId: string, email: string, role: UserRole) {
    const payload: JwtPayload = { sub: userId, email, role };
    const accessTtl = (process.env.JWT_ACCESS_TTL ?? '15m') as StringValue;
    const refreshTtl = (process.env.JWT_REFRESH_TTL ?? '7d') as StringValue;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret',
        expiresIn: accessTtl,
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret',
        expiresIn: refreshTtl,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshTokenHash(userId: string, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  private getMetadata(request?: { ip?: string; headers?: Record<string, unknown> }): AuditMetadata {
    const rawUserAgent = request?.headers?.['user-agent'];
    return {
      ipAddress: request?.ip,
      userAgent: typeof rawUserAgent === 'string' ? rawUserAgent : undefined,
    };
  }
}
