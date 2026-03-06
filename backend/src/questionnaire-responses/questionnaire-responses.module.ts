import { Module } from '@nestjs/common';
import { QuestionnaireResponsesController } from './questionnaire-responses.controller';
import { QuestionnaireResponsesService } from './questionnaire-responses.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OncologyNavigationModule } from '../oncology-navigation/oncology-navigation.module';

@Module({
  imports: [PrismaModule, OncologyNavigationModule],
  controllers: [QuestionnaireResponsesController],
  providers: [QuestionnaireResponsesService],
  exports: [QuestionnaireResponsesService],
})
export class QuestionnaireResponsesModule {}
