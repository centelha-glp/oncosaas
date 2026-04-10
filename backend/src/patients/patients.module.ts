import { Module, forwardRef } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OncologyNavigationModule } from '../oncology-navigation/oncology-navigation.module';
import { ComorbiditiesModule } from '../comorbidities/comorbidities.module';
import { MedicationsModule } from '../medications/medications.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => OncologyNavigationModule),
    ComorbiditiesModule,
    MedicationsModule,
  ],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}