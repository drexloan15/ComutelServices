import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AuditService } from './audit.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(@Query() query: AuditLogQueryDto) {
    return this.auditService.findMany(query);
  }

  @Get('export')
  async exportCsv(@Query() query: AuditLogQueryDto, @Res() res: Response) {
    const csv = await this.auditService.exportCsv(query);
    const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
