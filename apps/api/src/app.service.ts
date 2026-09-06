import { Injectable } from '@nestjs/common';
import { APP_NAME, type HealthResponse } from '@ntr/shared';

@Injectable()
export class AppService {
  health(): HealthResponse {
    return {
      status: 'ok',
      service: APP_NAME,
      timestamp: new Date().toISOString(),
    };
  }
}
