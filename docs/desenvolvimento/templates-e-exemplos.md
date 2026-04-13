# Templates e Exemplos Práticos

Guia rápido com templates prontos para uso durante o desenvolvimento.

## Templates de Código

### Frontend - Componente React com TypeScript

```typescript
// components/dashboard/PatientCard.tsx
'use client';

import { Patient } from '@/types/patient';
import { formatDate } from '@/lib/utils/date';

interface PatientCardProps {
  patient: Patient;
  onClick?: (patientId: string) => void;
}

export function PatientCard({ patient, onClick }: PatientCardProps) {
  const handleClick = () => {
    onClick?.(patient.id);
  };

  return (
    <div
      className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
      onClick={handleClick}
    >
      <h3 className="font-semibold">{patient.name}</h3>
      <p className="text-sm text-gray-600">
        Nascimento: {formatDate(patient.dateOfBirth)}
      </p>
      <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 rounded">
        {patient.status}
      </span>
    </div>
  );
}
```

---

### Frontend - Custom Hook com React Query

```typescript
// hooks/usePatients.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Patient } from '@/types/patient';

export function usePatients(tenantId: string) {
  return useQuery({
    queryKey: ['patients', tenantId],
    queryFn: async () => {
      const response = await apiClient.get<{ data: Patient[] }>(
        `/api/v1/patients`,
        {
          params: { tenantId },
        }
      );
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePatientDto) => {
      const response = await apiClient.post<{ data: Patient }>(
        '/api/v1/patients',
        data
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}
```

---

### Backend - Módulo NestJS Completo

```typescript
// modules/patients/patients.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
```

```typescript
// modules/patients/patients.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { Patient } from '@prisma/client';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string): Promise<Patient[]> {
    return this.prisma.patient.findMany({
      where: { tenantId }, // SEMPRE incluir tenantId
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Patient> {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id,
        tenantId, // SEMPRE validar tenantId
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    return patient;
  }

  async create(dto: CreatePatientDto, tenantId: string): Promise<Patient> {
    return this.prisma.patient.create({
      data: {
        ...dto,
        tenantId, // SEMPRE incluir tenantId
      },
    });
  }

  async update(
    id: string,
    dto: UpdatePatientDto,
    tenantId: string
  ): Promise<Patient> {
    // Verificar se paciente existe e pertence ao tenant
    await this.findOne(id, tenantId);

    return this.prisma.patient.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    // Verificar se paciente existe e pertence ao tenant
    await this.findOne(id, tenantId);

    await this.prisma.patient.delete({
      where: { id },
    });
  }
}
```

```typescript
// modules/patients/patients.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@ApiTags('patients')
@Controller('patients')
@UseGuards(JwtAuthGuard, TenantGuard) // Guards obrigatórios
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new patient' })
  @ApiResponse({ status: 201, description: 'Patient created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createPatientDto: CreatePatientDto, @Request() req) {
    return this.patientsService.create(createPatientDto, req.user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all patients' })
  @ApiResponse({ status: 200, description: 'List of patients' })
  findAll(@Request() req) {
    return this.patientsService.findAll(req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID' })
  @ApiResponse({ status: 200, description: 'Patient found' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.patientsService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update patient' })
  @ApiResponse({ status: 200, description: 'Patient updated' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  update(
    @Param('id') id: string,
    @Body() updatePatientDto: UpdatePatientDto,
    @Request() req
  ) {
    return this.patientsService.update(id, updatePatientDto, req.user.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete patient' })
  @ApiResponse({ status: 200, description: 'Patient deleted' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  remove(@Param('id') id: string, @Request() req) {
    return this.patientsService.remove(id, req.user.tenantId);
  }
}
```

```typescript
// modules/patients/dto/create-patient.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDate, IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePatientDto {
  @ApiProperty({ description: 'Patient name', example: 'João Silva' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Date of birth', example: '1980-01-15' })
  @IsDate()
  @Type(() => Date)
  dateOfBirth: Date;

  @ApiProperty({
    description: 'Gender',
    enum: ['male', 'female', 'other'],
    example: 'male',
  })
  @IsEnum(['male', 'female', 'other'])
  gender: string;

  @ApiProperty({ description: 'Diagnosis', example: 'Breast cancer' })
  @IsString()
  diagnosis?: string;

  @ApiProperty({ description: 'Tenant ID', example: 'uuid-here' })
  @IsUUID()
  tenantId: string;
}
```

---

### Backend - Guard de Tenant

```typescript
// common/guards/tenant.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    // Adicionar tenantId ao request para uso nos controllers
    request.tenantId = user.tenantId;

    return true;
  }
}
```

---

### AI Service - Rota FastAPI

```python
# api/routes/priority.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from src.models.priority_model import PriorityModel
from src.api.dependencies import get_tenant_id

router = APIRouter(prefix="/priority", tags=["priority"])


class PriorityRequest(BaseModel):
    patient_id: str
    symptoms: dict
    last_consultation_days: int
    stage: Optional[str] = None
    diagnosis: Optional[str] = None


class PriorityResponse(BaseModel):
    score: int
    category: str
    explanation: str


@router.post("/calculate", response_model=PriorityResponse)
async def calculate_priority(
    request: PriorityRequest,
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Calcula o score de prioridade de um paciente.

    Args:
        request: Dados do paciente para cálculo
        tenant_id: ID do tenant (injetado via dependency)

    Returns:
        Score de prioridade (0-100), categoria e explicação
    """
    try:
        model = PriorityModel()
        result = await model.predict(
            patient_id=request.patient_id,
            symptoms=request.symptoms,
            last_consultation_days=request.last_consultation_days,
            stage=request.stage,
            diagnosis=request.diagnosis,
            tenant_id=tenant_id
        )

        return PriorityResponse(
            score=result.score,
            category=result.category,
            explanation=result.explanation
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating priority: {str(e)}"
        )
```

---

### AI Service - Dependency para Tenant

```python
# api/dependencies.py
from fastapi import Header, HTTPException
from typing import Optional

async def get_tenant_id(
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID")
) -> str:
    """
    Extrai tenant_id do header da requisição.

    Args:
        x_tenant_id: Header X-Tenant-ID

    Returns:
        Tenant ID

    Raises:
        HTTPException: Se tenant_id não fornecido
    """
    if not x_tenant_id:
        raise HTTPException(
            status_code=403,
            detail="Tenant ID is required"
        )
    return x_tenant_id
```

---

### Teste Unitário - Backend (Jest)

```typescript
// modules/patients/patients.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('PatientsService', () => {
  let service: PatientsService;
  let prisma: PrismaService;

  const mockPrisma = {
    patient: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return patients filtered by tenant', async () => {
      const mockPatients = [
        { id: '1', name: 'Patient 1', tenantId: 'tenant-1' },
        { id: '2', name: 'Patient 2', tenantId: 'tenant-1' },
      ];

      mockPrisma.patient.findMany.mockResolvedValue(mockPatients);

      const result = await service.findAll('tenant-1');

      expect(mockPrisma.patient.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockPatients);
    });
  });

  describe('findOne', () => {
    it('should return patient if found', async () => {
      const mockPatient = {
        id: '1',
        name: 'Patient 1',
        tenantId: 'tenant-1',
      };

      mockPrisma.patient.findFirst.mockResolvedValue(mockPatient);

      const result = await service.findOne('1', 'tenant-1');

      expect(result).toEqual(mockPatient);
    });

    it('should throw NotFoundException if patient not found', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      await expect(service.findOne('1', 'tenant-1')).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
```

---

### Teste Unitário - Frontend (React Testing Library)

```typescript
// components/dashboard/PatientCard.test.tsx
import { render, screen } from '@testing-library/react';
import { PatientCard } from './PatientCard';

const mockPatient = {
  id: '1',
  name: 'João Silva',
  dateOfBirth: new Date('1980-01-15'),
  status: 'active',
  tenantId: 'tenant-1',
};

describe('PatientCard', () => {
  it('should render patient information', () => {
    render(<PatientCard patient={mockPatient} />);

    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText(/Nascimento:/)).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<PatientCard patient={mockPatient} onClick={handleClick} />);

    screen.getByText('João Silva').click();

    expect(handleClick).toHaveBeenCalledWith('1');
  });
});
```

---

## Schemas Prisma - Exemplos

```prisma
// prisma/schema.prisma
model Tenant {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users      User[]
  patients   Patient[]
  alerts     Alert[]
  conversations Conversation[]

  @@map("tenants")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String?
  role      String   @default("user") // admin, oncologist, nurse, manager
  tenantId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@map("users")
}

model Patient {
  id            String    @id @default(uuid())
  tenantId      String
  externalId    String? // ID do paciente no EHR/PMS
  name          String
  dateOfBirth   DateTime
  gender        String
  diagnosis     String?
  stage         String?
  currentTreatment String?
  status        String    @default("active") // active, in_treatment, follow_up, completed, deceased
  priorityScore Int       @default(0) // Score de prioridade gerado pela IA
  lastInteraction DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  conversations Conversation[]
  alerts Alert[]
  observations Observation[]

  @@index([tenantId])
  @@index([status])
  @@index([priorityScore])
  @@map("patients")
}

model Conversation {
  id            String   @id @default(uuid())
  tenantId      String
  patientId     String
  whatsappId    String   @unique // ID da mensagem/conversa no WhatsApp
  message       String
  messageType   String   // text, audio, image
  sender        String   // patient, agent, nurse
  audioUrl      String? // URL do áudio processado (STT)
  transcribedText String? // Texto transcrito do áudio
  extractedData Json? // Dados estruturados extraídos (sintomas, escalas)
  isCritical    Boolean  @default(false) // Sintoma crítico detectado?
  createdAt     DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([patientId])
  @@index([createdAt])
  @@map("conversations")
}

model Alert {
  id            String   @id @default(uuid())
  tenantId      String
  patientId     String
  type          String   // critical_symptom, no_response, delay
  message       String
  severity      String   // low, medium, high, critical
  acknowledged  Boolean  @default(false)
  acknowledgedBy String?
  acknowledgedAt DateTime?
  createdAt     DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([patientId])
  @@index([acknowledged])
  @@index([createdAt])
  @@map("alerts")
}

model Observation {
  id            String   @id @default(uuid())
  tenantId      String
  patientId     String
  fhirId        String? // ID no sistema FHIR
  code          String   // LOINC code
  value         String
  unit          String?
  effectiveDate DateTime
  createdAt     DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([patientId])
  @@index([fhirId])
  @@map("observations")
}
```

---

## Configurações Úteis

### ESLint Config (Frontend)

```json
// .eslintrc.json
{
  "extends": ["next/core-web-vitals", "plugin:@typescript-eslint/recommended"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

### Prettier Config

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### Jest Config (Backend)

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/main.ts'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

---

## Checklist de Desenvolvimento

### Antes de Começar uma Feature

- [ ] Ler documentação da feature no plano
- [ ] Verificar dependências (outras features, APIs externas)
- [ ] Criar branch a partir de `develop`
- [ ] Criar issue/ticket com descrição detalhada

### Durante o Desenvolvimento

- [ ] Seguir estrutura de pastas definida
- [ ] Incluir `tenantId` em todas as queries
- [ ] Validar dados de entrada (DTOs, schemas)
- [ ] Escrever testes unitários junto com código
- [ ] Documentar funções públicas (JSDoc/TSDoc)
- [ ] Não commitar dados sensíveis

### Antes de Commitar

- [ ] Código compila sem erros
- [ ] Testes passando
- [ ] Linter sem erros
- [ ] TypeScript sem erros
- [ ] Mensagem de commit descritiva

### Antes de Criar PR

- [ ] Revisar próprio código
- [ ] Atualizar documentação se necessário
- [ ] Adicionar screenshots se mudança de UI
- [ ] Verificar se quebra alguma feature existente
- [ ] Testar manualmente a feature

---

**Última atualização**: 2026-04-13  
**Versão**: 1.0.0
