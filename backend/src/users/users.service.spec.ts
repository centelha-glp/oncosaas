import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '@/prisma/prisma.service';
import { UserRole } from '@generated/prisma/client';
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
        { email: 'x@example.com', password: 'secret', role: UserRole.NURSE } as CreateUserDto,
        'tenant-1',
        UserRole.ADMIN,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should allow only ADMIN to create non-NURSE roles', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        { email: 'x@example.com', password: 'secret', role: UserRole.ADMIN } as CreateUserDto,
        'tenant-1',
        UserRole.NURSE_CHIEF,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should hash password before update', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', role: UserRole.NURSE, email: 'a@b.com' });
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
});
