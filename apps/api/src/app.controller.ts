import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@ntr/shared';

import { AppService } from './app.service';
import { Public } from './modules/auth/access-control/auth.decorators';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @Public()
  health(): HealthResponse {
    return this.appService.health();
  }
}
