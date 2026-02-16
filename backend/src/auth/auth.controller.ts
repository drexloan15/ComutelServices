import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { GetCurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { CurrentUser } from './types/current-user.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, req);
  }

  @Post('bootstrap-admin')
  bootstrapAdmin(@Body() dto: BootstrapAdminDto, @Req() req: Request) {
    return this.authService.bootstrapAdmin(dto, req);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, req);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@GetCurrentUser() user: CurrentUser, @Req() req: Request) {
    return this.authService.logout(user.sub, req);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@GetCurrentUser() user: CurrentUser) {
    return this.authService.me(user.sub);
  }
}
