# Skill: /novo-modulo-backend

## Descrição

Cria a estrutura completa de um novo módulo NestJS no backend, seguindo todos os padrões do projeto ONCONAV.

## Uso

```
/novo-modulo-backend <nome-do-modulo>
```

## O que faz

Dado o nome do módulo (ex: `reports`), cria os seguintes arquivos em `backend/src/<nome>/`:

### 1. `<nome>.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { <Nome>Service } from './<nome>.service';
import { <Nome>Controller } from './<nome>.controller';

@Module({
  imports: [PrismaModule],
  controllers: [<Nome>Controller],
  providers: [<Nome>Service],
  exports: [<Nome>Service],
})
export class <Nome>Module {}
```

### 2. `<nome>.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { <Nome>Service } from './<nome>.service';

@Controller('<nome>')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class <Nome>Controller {
  constructor(private readonly <nome>Service: <Nome>Service) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.<nome>Service.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.<nome>Service.findOne(id, user.tenantId);
  }
}
```

### 3. `<nome>.service.ts`

```typescript
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class <Nome>Service {
  private readonly logger = new Logger(<Nome>Service.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.<entidade>.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const item = await this.prisma.<entidade>.findFirst({
      where: { id, tenantId },
    });

    if (!item) {
      throw new NotFoundException('<Entidade> não encontrado(a)');
    }

    return item;
  }
}
```

### 4. `dto/` (diretório com DTOs)

- `create-<nome>.dto.ts` - com class-validator decorators
- `update-<nome>.dto.ts` - com PartialType

### 5. `<nome>.service.spec.ts`

- Testes unitários com Jest
- Mock do PrismaService
- Testes para findAll (com tenantId) e findOne

### 6. Registrar no `app.module.ts`

- Importar e adicionar o módulo à lista de imports

## Regras Obrigatórias

1. **Toda query Prisma DEVE incluir `tenantId`** no where clause
2. **Controllers DEVEM usar** `@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)`
3. **Parâmetros :id DEVEM usar** `ParseUUIDPipe`
4. **Usar NestJS Logger**, nunca console.log
5. **DTOs DEVEM usar** decoradores class-validator (`@IsString()`, `@IsUUID()`, etc.)
6. **Services NUNCA devem** acessar `request` diretamente — recebem tenantId como parâmetro

## Referências

- Padrão existente: `backend/src/patients/` (exemplo completo)
- Guards: `backend/src/auth/guards/`
- Prisma: `backend/src/prisma/prisma.service.ts`
- AppModule: `backend/src/app.module.ts`
