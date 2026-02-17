import {
  Controller,
  Get,
  Headers,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { getRuntimeConfig } from '../config/runtime-config';
import { MonitoringService } from './monitoring.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('health/live')
  getLiveness() {
    return this.monitoringService.getLiveness();
  }

  @Get('health/ready')
  getReadiness() {
    return this.monitoringService.getReadiness();
  }

  @Get('metrics')
  async getMetrics(
    @Headers('x-monitoring-token') monitoringToken: string | undefined,
    @Res() res: Response,
  ) {
    const config = getRuntimeConfig();
    if (config.monitoringMetricsToken) {
      if (monitoringToken !== config.monitoringMetricsToken) {
        throw new UnauthorizedException('Monitoring token invalido');
      }
    }

    res.setHeader(
      'Content-Type',
      this.monitoringService.getMetricsContentType(),
    );
    res.send(await this.monitoringService.getMetrics());
  }
}
