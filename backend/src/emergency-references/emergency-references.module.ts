import { Module } from '@nestjs/common';
import { EmergencyReferencesService } from './emergency-references.service';
import { EmergencyReferencesController } from './emergency-references.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmergencyReferencesController],
  providers: [EmergencyReferencesService],
  exports: [EmergencyReferencesService],
})
export class EmergencyReferencesModule {}
