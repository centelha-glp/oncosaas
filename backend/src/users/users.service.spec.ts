import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ClinicalSubrole, UserRole } from '@generated/prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UsersService', () => {
  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('should reject create when email already exists in tenant', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1' });

    await expect(
      service.create(
        {
          name: 'N',
          email: 'x@example.com',
          password: 'secret12',
          role: UserRole.NURSE,
          corenUf: 'SP',
          corenNumber: '123456',
        } as CreateUserDto,
        'tenant-1',
        UserRole.ADMIN,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should allow only ADMIN to create non-NURSE roles', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          name: 'A',
          email: 'x@example.com',
          password: 'secret12',
          role: UserRole.ADMIN,
        } as CreateUserDto,
        'tenant-1',
        UserRole.NURSE_CHIEF,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject create NURSE without COREN data', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          name: 'N',
          email: 'x@example.com',
          password: 'secret12',
          role: UserRole.NURSE,
        } as CreateUserDto,
        'tenant-1',
        UserRole.ADMIN,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('should reject COORDINATOR with subpapel médico sem CRM', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          name: 'Coord',
          email: 'c@example.com',
          password: 'secret12',
          role: UserRole.COORDINATOR,
          clinicalSubrole: ClinicalSubrole.MEDICAL,
        } as CreateUserDto,
        'tenant-1',
        UserRole.ADMIN,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('should create COORDINATOR with MEDICAL e CRM', async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'u-co',
      role: UserRole.COORDINATOR,
      clinicalSubrole: ClinicalSubrole.MEDICAL,
      crmUf: 'SP',
      crmNumber: '100',
    });

    await service.create(
      {
        name: 'Coord',
        email: 'coord@example.com',
        password: 'secret12',
        role: UserRole.COORDINATOR,
        clinicalSubrole: ClinicalSubrole.MEDICAL,
        crmUf: 'SP',
        crmNumber: '100',
      } as CreateUserDto,
      'tenant-1',
      UserRole.ADMIN,
    );

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clinicalSubrole: ClinicalSubrole.MEDICAL,
          crmUf: 'SP',
          crmNumber: '100',
          corenUf: null,
          corenNumber: null,
        }),
      }),
    );
  });

  it('should create ONCOLOGIST with CRM', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'u1',
      email: 'd@example.com',
      name: 'Dr',
      role: UserRole.ONCOLOGIST,
      crmUf: 'RJ',
      crmNumber: '999',
      corenUf: null,
      corenNumber: null,
    });

    await service.create(
      {
        name: 'Dr',
        email: 'd@example.com',
        password: 'secret12',
        role: UserRole.ONCOLOGIST,
        crmUf: 'RJ',
        crmNumber: '999',
      } as CreateUserDto,
      'tenant-1',
      UserRole.ADMIN,
    );

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: UserRole.ONCOLOGIST,
          crmUf: 'RJ',
          crmNumber: '999',
          corenUf: null,
          corenNumber: null,
        }),
      }),
    );
  });

  it('should hash password before update', async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({
        id: 'u1',
        role: UserRole.NURSE,
        email: 'a@b.com',
        crmUf: null,
        crmNumber: null,
        corenUf: 'SP',
        corenNumber: '111',
      })
      .mockResolvedValueOnce(null);
    mockPrisma.user.update.mockResolvedValue({ id: 'u1' });
    const hashSpy = jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-value' as never);

    await service.update('u1', { password: 'newpass' } as UpdateUserDto, 'tenant-1', UserRole.ADMIN);

    expect(hashSpy).toHaveBeenCalledWith('newpass', 10);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1', tenantId: 'tenant-1' },
        data: expect.objectContaining({ password: 'hashed-value' }),
      }),
    );

    hashSpy.mockRestore();
  });

  it('should block deleting the last admin of tenant', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'admin-1', role: UserRole.ADMIN });
    mockPrisma.user.count.mockResolvedValue(1);

    await expect(service.remove('admin-1', 'tenant-1')).rejects.toThrow(BadRequestException);
  });

  it('findAll deve paginar com default 100 e teto 500', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    await service.findAll('tenant-1');
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100, skip: 0 }),
    );

    await service.findAll('tenant-1', { limit: 9999 });
    expect(mockPrisma.user.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 500 }),
    );
  });
});
