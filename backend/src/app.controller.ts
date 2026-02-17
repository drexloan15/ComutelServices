import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { MonitoringService } from './monitoring/monitoring.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly monitoringService: MonitoringService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return this.monitoringService.getLiveness();
  }
}
