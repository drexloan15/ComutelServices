import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { SlaController } from './sla.controller';
import { SlaService } from './sla.service';

@Module({
  imports: [NotificationsModule],
  controllers: [SlaController],
  providers: [SlaService, JwtAuthGuard, RolesGuard],
  exports: [SlaService],
})
export class SlaModule {}
