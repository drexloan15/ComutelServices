import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.REQUESTER)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(
    @GetCurrentUser() currentUser: CurrentUser,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.findMine(currentUser, query);
  }

  @Patch(':id/read')
  markAsRead(
    @Param('id') id: string,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.notificationsService.markAsRead(id, currentUser);
  }

  @Patch('read-all')
  markAllAsRead(@GetCurrentUser() currentUser: CurrentUser) {
    return this.notificationsService.markAllAsRead(currentUser);
  }
}
