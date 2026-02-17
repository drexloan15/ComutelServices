import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CmdbController } from './cmdb.controller';
import { CmdbService } from './cmdb.service';

@Module({
  controllers: [CmdbController],
  providers: [CmdbService, JwtAuthGuard, RolesGuard],
  exports: [CmdbService],
})
export class CmdbModule {}
