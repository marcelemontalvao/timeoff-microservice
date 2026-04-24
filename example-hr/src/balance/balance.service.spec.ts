import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BalanceService, BalanceResponse } from './balance.service';
import { Balance } from './entities/balance.entity';

describe('BalanceService', () => {
  let service: BalanceService;
  let repository: Repository<Balance>;

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        {
          provide: getRepositoryToken(Balance),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
    repository = module.get<Repository<Balance>>(getRepositoryToken(Balance));

    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('should return balance for employee+location', async () => {
      const mockBalance: Balance = {
        id: 'uuid-1',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 10,
        reserved: 2,
        used: 3,
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Balance;

      mockRepository.findOne.mockResolvedValue(mockBalance);

      const result = await service.getBalance('EMP001', 'LOC001');

      expect(result.employeeId).toBe('EMP001');
      expect(result.locationId).toBe('LOC001');
      expect(result.available).toBe(5); // 10 - 2 - 3 = 5
      expect(result.reserved).toBe(2);
      expect(result.used).toBe(3);
    });

    it('should create default balance if not exists', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 0,
        reserved: 0,
        used: 0,
      });
      mockRepository.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.getBalance('EMP001', 'LOC001');

      expect(result.available).toBe(0);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('reserveDays', () => {
    it('should reserve days when balance is sufficient', async () => {
      const mockBalance: Balance = {
        id: 'uuid-1',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 10,
        reserved: 0,
        used: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Balance;

      mockRepository.findOne.mockResolvedValue(mockBalance);
      mockRepository.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.reserveDays('EMP001', 'LOC001', 5, 'req-1');

      expect(result.success).toBe(true);
      expect(result.balance).toBeDefined();
    });

    it('should fail when balance is insufficient', async () => {
      const mockBalance: Balance = {
        id: 'uuid-1',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 5,
        reserved: 3,
        used: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Balance;

      mockRepository.findOne.mockResolvedValue(mockBalance);

      const result = await service.reserveDays('EMP001', 'LOC001', 5, 'req-1');

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Insufficient balance');
    });

    it('should handle idempotency', async () => {
      const mockBalance: Balance = {
        id: 'uuid-1',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 10,
        reserved: 2,
        used: 0,
        idempotencyKey: 'idem-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Balance;

      mockRepository.findOne
        .mockResolvedValueOnce(null) // First call for idempotency check
        .mockResolvedValueOnce(mockBalance); // Second call for balance lookup

      const result = await service.reserveDays('EMP001', 'LOC001', 5, 'req-1', 'idem-1');

      expect(result.success).toBe(true);
    });
  });

  describe('releaseDays', () => {
    it('should release reserved days', async () => {
      const mockBalance: Balance = {
        id: 'uuid-1',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 10,
        reserved: 5,
        used: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Balance;

      mockRepository.findOne.mockResolvedValue(mockBalance);
      mockRepository.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.releaseDays('EMP001', 'LOC001', 3);

      expect(result.reserved).toBe(2);
    });

    it('should throw NotFoundException when balance not exists', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.releaseDays('EMP001', 'LOC001', 3)).rejects.toThrow();
    });
  });

  describe('commitDays', () => {
    it('should commit reserved days to used', async () => {
      const mockBalance: Balance = {
        id: 'uuid-1',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 10,
        reserved: 5,
        used: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Balance;

      mockRepository.findOne.mockResolvedValue(mockBalance);
      mockRepository.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.commitDays('EMP001', 'LOC001', 3);

      expect(result.used).toBe(3);
      expect(result.reserved).toBe(2);
    });

    it('should throw ConflictException when trying to commit more than reserved', async () => {
      const mockBalance: Balance = {
        id: 'uuid-1',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 10,
        reserved: 2,
        used: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Balance;

      mockRepository.findOne.mockResolvedValue(mockBalance);

      await expect(service.commitDays('EMP001', 'LOC001', 5)).rejects.toThrow();
    });
  });

  describe('syncFromHcm', () => {
    it('should sync balance from HCM', async () => {
      const mockBalance: Balance = {
        id: 'uuid-1',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 5,
        reserved: 0,
        used: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Balance;

      mockRepository.findOne.mockResolvedValue(mockBalance);
      mockRepository.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.syncFromHcm('EMP001', 'LOC001', 15, 'v2');

      expect(result.available).toBe(15);
    });

    it('should create new balance if not exists', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 10,
        reserved: 0,
        used: 0,
    });
      mockRepository.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.syncFromHcm('EMP001', 'LOC001', 10);

      expect(result.available).toBe(10);
      expect(mockRepository.create).toHaveBeenCalled();
    });
  });
});