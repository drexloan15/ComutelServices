import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { CreateSlaPolicyDto } from './dto/create-sla-policy.dto';
import { CreateBusinessCalendarDto } from './dto/create-business-calendar.dto';
import { SlaPredictionQueryDto } from './dto/sla-prediction-query.dto';
import { SlaTrackingQueryDto } from './dto/sla-tracking-query.dto';
import { ToggleSlaPauseDto } from './dto/toggle-sla-pause.dto';
import { UpdateSlaPolicyDto } from './dto/update-sla-policy.dto';
import { SlaService } from './sla.service';

@Controller('sla')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get('policies')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  findPolicies() {
    return this.slaService.findPolicies();
  }

  @Post('policies')
  @Roles(UserRole.ADMIN)
  createPolicy(@Body() dto: CreateSlaPolicyDto) {
    return this.slaService.createPolicy(dto);
  }

  @Patch('policies/:id')
  @Roles(UserRole.ADMIN)
  updatePolicy(@Param('id') id: string, @Body() dto: UpdateSlaPolicyDto) {
    return this.slaService.updatePolicy(id, dto);
  }

  @Get('tracking')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  findTracking(@Query() query: SlaTrackingQueryDto) {
    return this.slaService.findTracking(query);
  }

  @Post('engine/run')
  @Roles(UserRole.ADMIN)
  runEngine(@GetCurrentUser() currentUser: CurrentUser) {
    return this.slaService.runEngineByCurrentUser(currentUser);
  }

  @Get('calendars')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  findCalendars() {
    return this.slaService.findCalendars();
  }

  @Post('calendars')
  @Roles(UserRole.ADMIN)
  createCalendar(@Body() dto: CreateBusinessCalendarDto) {
    return this.slaService.createCalendar(dto);
  }

  @Patch('tracking/:ticketId/pause')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  pauseTracking(
    @Param('ticketId') ticketId: string,
    @Body() dto: ToggleSlaPauseDto,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.slaService.pauseTracking(ticketId, currentUser, dto.reason);
  }

  @Patch('tracking/:ticketId/resume')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  resumeTracking(
    @Param('ticketId') ticketId: string,
    @Body() dto: ToggleSlaPauseDto,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.slaService.resumeTracking(ticketId, currentUser, dto.reason);
  }

  @Get('predictions')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  getPredictions(@Query() query: SlaPredictionQueryDto) {
    return this.slaService.getBreachPredictions(query);
  }
}
