import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { getRuntimeConfig } from '../config/runtime-config';
import { GetCurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { CurrentUser } from './types/current-user.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.register(dto, req);
    this.setRefreshCookie(res, response.refreshToken);
    return response;
  }

  @Post('bootstrap-admin')
  async bootstrapAdmin(
    @Body() dto: BootstrapAdminDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.bootstrapAdmin(dto, req);
    this.setRefreshCookie(res, response.refreshToken);
    return response;
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.login(dto, req);
    this.setRefreshCookie(res, response.refreshToken);
    return response;
  }

  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.resolveRefreshToken(req, dto);
    const response = await this.authService.refresh(refreshToken, req);
    this.setRefreshCookie(res, response.refreshToken);
    return response;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @GetCurrentUser() user: CurrentUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearRefreshCookie(res);
    return this.authService.logout(user.sub, req);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@GetCurrentUser() user: CurrentUser) {
    return this.authService.me(user.sub);
  }

  private resolveRefreshToken(req: Request, dto: RefreshTokenDto): string {
    const fromBody = dto.refreshToken?.trim();
    if (fromBody) {
      return fromBody;
    }

    const config = getRuntimeConfig();
    if (!config.refreshCookieEnabled) {
      throw new UnauthorizedException('Refresh token requerido');
    }

    const fromCookie = req.cookies?.[config.refreshCookieName] as
      | string
      | undefined;
    if (typeof fromCookie !== 'string' || !fromCookie.trim()) {
      throw new UnauthorizedException('Refresh token requerido');
    }

    return fromCookie.trim();
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    const config = getRuntimeConfig();
    if (!config.refreshCookieEnabled) {
      return;
    }

    res.cookie(config.refreshCookieName, refreshToken, {
      httpOnly: true,
      secure: config.refreshCookieSecure,
      sameSite: config.refreshCookieSameSite,
      path: config.refreshCookiePath,
      domain: config.refreshCookieDomain,
    });
  }

  private clearRefreshCookie(res: Response) {
    const config = getRuntimeConfig();
    if (!config.refreshCookieEnabled) {
      return;
    }

    res.clearCookie(config.refreshCookieName, {
      httpOnly: true,
      secure: config.refreshCookieSecure,
      sameSite: config.refreshCookieSameSite,
      path: config.refreshCookiePath,
      domain: config.refreshCookieDomain,
    });
  }
}
