import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { ActivitiesController } from './activities.controller';
import { ActivityScheduleController } from './activity-schedule.controller';
import { ActivityScoreController } from './activity-score.controller';
import { ActivitySignupsController } from './activity-signups.controller';
import { ActivityStandingsController } from './activity-standings.controller';
import { MyRecordsController } from './my-records.controller';
import { ActivitiesService } from './activities.service';
import { ActivityScheduleService } from './activity-schedule.service';
import { ActivityScoreService } from './activity-score.service';
import { ActivitySignupService } from './activity-signup.service';
import { ActivityStandingsService } from './activity-standings.service';
import { MyRecordsService } from './my-records.service';
import { ActivityRepository } from './activity.repository';
import { ActivitySignupRepository } from './activity-signup.repository';
import { ActivityMatchRepository } from './activity-match.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [
    ActivitiesController,
    ActivitySignupsController,
    ActivityScheduleController,
    ActivityScoreController,
    ActivityStandingsController,
    MyRecordsController,
  ],
  providers: [
    ActivitiesService,
    ActivityScheduleService,
    ActivityScoreService,
    ActivitySignupService,
    ActivityStandingsService,
    MyRecordsService,
    ActivityRepository,
    ActivitySignupRepository,
    ActivityMatchRepository,
  ],
})
export class ActivitiesModule {}
