import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { AuthModule } from './modules/auth/auth.module';

const workspaceRoot = resolve(__dirname, '../../..');
const apiRoot = resolve(__dirname, '..');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(workspaceRoot, '.env.local'),
        resolve(workspaceRoot, '.env'),
        resolve(apiRoot, '.env.local'),
        resolve(apiRoot, '.env'),
      ],
    }),
    DatabaseModule,
    AuthModule,
    ActivitiesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
