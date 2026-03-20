import { Module } from '@nestjs/common';
import { ComorbiditiesService } from './comorbidities.service';
import { ComorbiditiesController } from './comorbidities.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ComorbiditiesController],
  providers: [ComorbiditiesService],
  exports: [ComorbiditiesService],
})
export class ComorbiditiesModule {}
