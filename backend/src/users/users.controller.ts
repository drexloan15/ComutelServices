import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';
import { Req } from '@nestjs/common';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/role')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @GetCurrentUser() currentUser: CurrentUser,
    @Req() req: Request,
  ) {
    return this.usersService.updateRole(id, dto.role, currentUser.sub, req);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @GetCurrentUser() currentUser: CurrentUser,
    @Req() req: Request,
  ) {
    return this.usersService.updateStatus(id, dto.isActive, currentUser.sub, req);
  }
}
