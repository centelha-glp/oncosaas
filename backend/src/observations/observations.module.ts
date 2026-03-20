import { Module, forwardRef } from '@nestjs/common';
import { ObservationsService } from './observations.service';
import { ObservationsController } from './observations.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FHIRModule } from '../integrations/fhir/fhir.module';
import { OncologyNavigationModule } from '../oncology-navigation/oncology-navigation.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => FHIRModule),
    OncologyNavigationModule,
  ],
  controllers: [ObservationsController],
  providers: [ObservationsService],
  exports: [ObservationsService],
})
export class ObservationsModule {}
