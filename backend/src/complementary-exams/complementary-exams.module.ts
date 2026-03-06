import { Module } from '@nestjs/common';
import { ComplementaryExamsService } from './complementary-exams.service';
import { ComplementaryExamsController } from './complementary-exams.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OncologyNavigationModule } from '../oncology-navigation/oncology-navigation.module';

@Module({
  imports: [PrismaModule, OncologyNavigationModule],
  controllers: [ComplementaryExamsController],
  providers: [ComplementaryExamsService],
  exports: [ComplementaryExamsService],
})
export class ComplementaryExamsModule {}
