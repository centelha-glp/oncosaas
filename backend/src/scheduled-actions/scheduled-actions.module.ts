import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduledActionsService } from './scheduled-actions.service';
import { ScheduledActionsController } from './scheduled-actions.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ScheduledActionsController],
  providers: [ScheduledActionsService],
  exports: [ScheduledActionsService],
})
export class ScheduledActionsModule {}
