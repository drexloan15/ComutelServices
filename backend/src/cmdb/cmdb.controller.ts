import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ServiceLinkType, UserRole } from '@prisma/client';
import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { CmdbService } from './cmdb.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CreateBusinessServiceDto } from './dto/create-business-service.dto';
import { CreateServiceDependencyDto } from './dto/create-service-dependency.dto';
import { LinkAssetToServiceDto } from './dto/link-asset-to-service.dto';
import { UpdateBusinessServiceDto } from './dto/update-business-service.dto';

@Controller('cmdb')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CmdbController {
  constructor(private readonly cmdbService: CmdbService) {}

  @Get('services')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  findServices() {
    return this.cmdbService.findServices();
  }

  @Post('services')
  @Roles(UserRole.ADMIN)
  createService(@Body() dto: CreateBusinessServiceDto) {
    return this.cmdbService.createService(dto);
  }

  @Patch('services/:id')
  @Roles(UserRole.ADMIN)
  updateService(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessServiceDto,
  ) {
    return this.cmdbService.updateService(id, dto);
  }

  @Post('services/dependencies')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  createDependency(@Body() dto: CreateServiceDependencyDto) {
    return this.cmdbService.createServiceDependency(dto);
  }

  @Post('services/:serviceId/assets/:assetId')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  linkAssetToService(
    @Param('serviceId') serviceId: string,
    @Param('assetId') assetId: string,
    @Body() dto: LinkAssetToServiceDto,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.cmdbService.linkAssetToService(
      serviceId,
      assetId,
      currentUser,
      dto.linkType ?? ServiceLinkType.SUPPORTING,
    );
  }

  @Get('assets')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  findAssets() {
    return this.cmdbService.findAssets();
  }

  @Post('assets')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  createAsset(@Body() dto: CreateAssetDto) {
    return this.cmdbService.createAsset(dto);
  }

  @Get('tickets/:ticketId/impact')
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.REQUESTER)
  getTicketImpact(@Param('ticketId') ticketId: string) {
    return this.cmdbService.getTicketImpact(ticketId);
  }
}
