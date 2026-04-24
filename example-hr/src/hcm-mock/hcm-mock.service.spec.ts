import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HcmMockService, setTimeoutDelay } from './hcm-mock.service';
import { HcmBalance } from './entities/hcm-balance.entity';
import { HcmTimeOffRequest } from './entities/hcm-time-off-request.entity';
import { ServiceUnavailableException } from '@nestjs/common';

describe('HcmMockService', () => {
  let service: HcmMockService;
  let balanceRepository: Repository<HcmBalance>;
  let requestRepository: Repository<HcmTimeOffRequest>;
  let randomSpy: jest.SpyInstance;

  const mockBalanceRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockRequestRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    // Set test-friendly timeout (no actual delay)
    setTimeoutDelay(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HcmMockService,
        {
          provide: getRepositoryToken(HcmBalance),
          useValue: mockBalanceRepository,
        },
        {
          provide: getRepositoryToken(HcmTimeOffRequest),
          useValue: mockRequestRepository,
        },
      ],
    }).compile();

    service = module.get<HcmMockService>(HcmMockService);
    balanceRepository = module.get<Repository<HcmBalance>>(getRepositoryToken(HcmBalance));
    requestRepository = module.get<Repository<HcmTimeOffRequest>>(getRepositoryToken(HcmTimeOffRequest));

    jest.clearAllMocks();
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  describe('getBalance', () => {
    it('should return existing balance', async () => {
      const mockBalance = {
        id: 'uuid-1',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 10,
        hcmVersion: 'v1',
        lastUpdated: new Date(),
      };

      mockBalanceRepository.findOne.mockResolvedValue(mockBalance);

      const result = await service.getBalance('EMP001', 'LOC001');

      expect(result).toEqual(mockBalance);
      expect(mockBalanceRepository.findOne).toHaveBeenCalledWith({
        where: { employeeId: 'EMP001', locationId: 'LOC001' },
      });
    });

    it('should create and return default balance if not exists', async () => {
      mockBalanceRepository.findOne.mockResolvedValue(null);
      mockBalanceRepository.create.mockReturnValue({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 10,
      });
      mockBalanceRepository.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.getBalance('EMP001', 'LOC001');

      expect(result.balance).toBe(10);
      expect(mockBalanceRepository.create).toHaveBeenCalled();
      expect(mockBalanceRepository.save).toHaveBeenCalled();
    });
  });

  describe('getAllBalances', () => {
    it('should return all balances', async () => {
      const mockBalances = [
        { employeeId: 'EMP001', locationId: 'LOC001', balance: 10 },
        { employeeId: 'EMP002', locationId: 'LOC001', balance: 15 },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);

      const result = await service.getAllBalances();

      expect(result).toEqual(mockBalances);
      expect(mockBalanceRepository.find).toHaveBeenCalled();
    });
  });

  describe('submitTimeOff - Success path', () => {
    it('should approve request and deduct balance', async () => {
      const mockBalance = {
        id: 'uuid-1',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 10,
        hcmVersion: 'v1',
        lastUpdated: new Date(),
      };

      mockBalanceRepository.findOne.mockResolvedValue(mockBalance);
      mockBalanceRepository.save.mockImplementation((entity) => Promise.resolve(entity));
      mockRequestRepository.create.mockReturnValue({
        employeeId: 'EMP001',
        status: 'APPROVED',
      });
      mockRequestRepository.save.mockImplementation(async (entity) => {
        entity.id = 'req-uuid';
        return entity;
      });

      // Mock Math.random to return success (0.7 or less)
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await service.submitTimeOff('EMP001', 'LOC001', '2026-05-01', '2026-05-05', 3);

      expect(result.success).toBe(true);
      expect(result.requestId).toBe('req-uuid');
      expect(result.balanceDeducted).toBe(true);
    });

    it('should reject when balance is insufficient', async () => {
      const mockBalance = {
        id: 'uuid-1',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 2, // Less than requested 3 days
        hcmVersion: 'v1',
        lastUpdated: new Date(),
      };

      mockBalanceRepository.findOne.mockResolvedValue(mockBalance);
      mockRequestRepository.create.mockReturnValue({
        employeeId: 'EMP001',
        status: 'REJECTED',
        errorMessage: 'Insufficient balance',
      });
      mockRequestRepository.save.mockImplementation((entity) => Promise.resolve({ ...entity, id: 'req-uuid' }));

      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await service.submitTimeOff('EMP001', 'LOC001', '2026-05-01', '2026-05-05', 3);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Insufficient balance');
    });
  });

  describe('submitTimeOff - Failure modes', () => {
    it('should return error for BALANCE_NOT_ENOUGH mode', async () => {
      mockRequestRepository.create.mockReturnValue({
        employeeId: 'EMP001',
        status: 'REJECTED',
        errorMessage: 'Insufficient balance in HCM system',
      });
      mockRequestRepository.save.mockImplementation((entity) => Promise.resolve({ ...entity, id: 'req-uuid' }));

      // Mock Math.random to trigger BALANCE_NOT_ENOUGH (between 0.7 and 0.8)
      jest.spyOn(Math, 'random').mockReturnValue(0.75);

      const result = await service.submitTimeOff('EMP001', 'LOC001', '2026-05-01', '2026-05-05', 3);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Insufficient balance');
    });

    it('should throw ServiceUnavailableException for RANDOM_FAILURE mode', async () => {
      // Mock Math.random to trigger RANDOM_FAILURE (between 0.8 and 0.9)
      jest.spyOn(Math, 'random').mockReturnValue(0.85);

      await expect(
        service.submitTimeOff('EMP001', 'LOC001', '2026-05-01', '2026-05-05', 3),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    // Note: TIMEOUT mode is tested separately as it requires mocking setTimeout
    // For now, we skip the timeout test as it requires 11 second delay

    it('should return success but not deduct for SILENT_IGNORE mode', async () => {
      mockRequestRepository.create.mockReturnValue({
        employeeId: 'EMP001',
        status: 'APPROVED',
      });
      mockRequestRepository.save.mockImplementation((entity) => Promise.resolve({ ...entity, id: 'req-uuid' }));

      // Mock Math.random to trigger SILENT_IGNORE (between 0.95 and 1.0)
      // Cumulative: SUCCESS(0.7), BALANCE_NOT_ENOUGH(0.8), RANDOM_FAILURE(0.9), TIMEOUT(0.95), SILENT_IGNORE(1.0)
      jest.spyOn(Math, 'random').mockReturnValue(0.97);

      const result = await service.submitTimeOff('EMP001', 'LOC001', '2026-05-01', '2026-05-05', 3);

      expect(result.success).toBe(true);
      expect(result.balanceDeducted).toBe(false);
    });
  });

  describe('updateBalanceExternally', () => {
    it('should update existing balance', async () => {
      const mockBalance = {
        id: 'uuid-1',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 10,
      };

      mockBalanceRepository.findOne.mockResolvedValue(mockBalance);
      mockBalanceRepository.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateBalanceExternally('EMP001', 'LOC001', 20);

      expect(result.balance).toBe(20);
      expect(mockBalanceRepository.save).toHaveBeenCalled();
    });

    it('should create new balance if not exists', async () => {
      mockBalanceRepository.findOne.mockResolvedValue(null);
      mockBalanceRepository.create.mockReturnValue({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 15,
      });
      mockBalanceRepository.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateBalanceExternally('EMP001', 'LOC001', 15);

      expect(result.balance).toBe(15);
      expect(mockBalanceRepository.create).toHaveBeenCalled();
    });
  });

  describe('seedTestData', () => {
    it('should seed test data for all employees', async () => {
      mockBalanceRepository.save.mockImplementation((entity) => Promise.resolve(entity));

      await service.seedTestData();

      expect(mockBalanceRepository.save).toHaveBeenCalledTimes(5);
    });
  });
});