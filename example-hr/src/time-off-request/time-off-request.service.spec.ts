import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffRequestService, CreateTimeOffRequestDto } from './time-off-request.service';
import { TimeOffRequest, TimeOffStatus } from './entities/time-off-request.entity';
import { BalanceService } from '../balance/balance.service';
import { HcmMockService } from '../hcm-mock/hcm-mock.service';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('TimeOffRequestService', () => {
  let service: TimeOffRequestService;
  let requestRepository: Repository<TimeOffRequest>;
  let balanceService: BalanceService;
  let hcmMockService: HcmMockService;

  const mockRequestRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockBalanceService = {
    reserveDays: jest.fn(),
    releaseDays: jest.fn(),
    commitDays: jest.fn(),
    getBalance: jest.fn(),
  };

  const mockHcmMockService = {
    submitTimeOff: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeOffRequestService,
        {
          provide: getRepositoryToken(TimeOffRequest),
          useValue: mockRequestRepository,
        },
        {
          provide: BalanceService,
          useValue: mockBalanceService,
        },
        {
          provide: HcmMockService,
          useValue: mockHcmMockService,
        },
      ],
    }).compile();

    service = module.get<TimeOffRequestService>(TimeOffRequestService);
    requestRepository = module.get<Repository<TimeOffRequest>>(getRepositoryToken(TimeOffRequest));
    balanceService = module.get<BalanceService>(BalanceService);
    hcmMockService = module.get<HcmMockService>(HcmMockService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateTimeOffRequestDto = {
      employeeId: 'EMP001',
      locationId: 'LOC001',
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      days: 5,
    };

    it('should create a new time-off request', async () => {
      mockBalanceService.reserveDays.mockResolvedValue({
        success: true,
        balance: { available: 5, reserved: 5, used: 0 },
      });

      mockRequestRepository.create.mockReturnValue({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        status: 'PENDING',
      });
      mockRequestRepository.save.mockImplementation((entity) => Promise.resolve({ ...entity, id: 'req-uuid' }));

      const result = await service.create(createDto);

      expect(result.employeeId).toBe('EMP001');
      expect(result.status).toBe('PENDING');
      expect(mockBalanceService.reserveDays).toHaveBeenCalled();
    });

    it('should fail when balance is insufficient', async () => {
      mockBalanceService.reserveDays.mockResolvedValue({
        success: false,
        errorMessage: 'Insufficient balance',
      });

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should fail when start date is after end date', async () => {
      const invalidDto = { ...createDto, startDate: '2026-05-10', endDate: '2026-05-01' };

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should fail when days is zero or negative', async () => {
      const invalidDto = { ...createDto, days: 0 };

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle idempotency', async () => {
      const existingRequest: TimeOffRequest = {
        id: 'req-existing',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        days: 5,
        status: 'PENDING' as TimeOffStatus,
        localApproval: false,
        hcmApproved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as TimeOffRequest;

      mockRequestRepository.findOne.mockResolvedValue(existingRequest);

      const result = await service.create({ ...createDto, idempotencyKey: 'idem-1' });

      expect(result.id).toBe('req-existing');
    });
  });

  describe('getById', () => {
    it('should return request by id', async () => {
      const mockRequest: TimeOffRequest = {
        id: 'req-1',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        days: 5,
        status: 'PENDING' as TimeOffStatus,
        localApproval: false,
        hcmApproved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as TimeOffRequest;

      mockRequestRepository.findOne.mockResolvedValue(mockRequest);

      const result = await service.getById('req-1');

      expect(result.id).toBe('req-1');
    });

    it('should throw NotFoundException when request not found', async () => {
      mockRequestRepository.findOne.mockResolvedValue(null);

      await expect(service.getById('req-nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approve', () => {
    it('should approve request and sync with HCM', async () => {
      const mockRequest: TimeOffRequest = {
        id: 'req-1',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        days: 5,
        status: 'PENDING' as TimeOffStatus,
        localApproval: false,
        hcmApproved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as TimeOffRequest;

      mockRequestRepository.findOne.mockResolvedValue(mockRequest);
      mockRequestRepository.save.mockImplementation((entity) => Promise.resolve(entity));
      mockHcmMockService.submitTimeOff.mockResolvedValue({
        success: true,
        requestId: 'hcm-1',
      });
      mockBalanceService.commitDays.mockResolvedValue({
        available: 5,
        reserved: 0,
        used: 5,
      });

      const result = await service.approve('req-1');

      expect(result.success).toBe(true);
      expect(result.request?.status).toBe('APPROVED');
      expect(mockBalanceService.commitDays).toHaveBeenCalled();
    });

    it('should reject when HCM fails', async () => {
      const mockRequest: TimeOffRequest = {
        id: 'req-1',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        days: 5,
        status: 'PENDING' as TimeOffStatus,
        localApproval: false,
        hcmApproved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as TimeOffRequest;

      mockRequestRepository.findOne.mockResolvedValue(mockRequest);
      mockRequestRepository.save.mockImplementation((entity) => Promise.resolve(entity));
      mockHcmMockService.submitTimeOff.mockResolvedValue({
        success: false,
        requestId: 'hcm-1',
        errorMessage: 'Insufficient balance',
      });
      mockBalanceService.releaseDays.mockResolvedValue({
        available: 10,
        reserved: 0,
        used: 0,
      });

      const result = await service.approve('req-1');

      expect(result.success).toBe(false);
      expect(result.request?.status).toBe('REJECTED');
      expect(mockBalanceService.releaseDays).toHaveBeenCalled();
    });

    it('should fail when request is not PENDING', async () => {
      const mockRequest: TimeOffRequest = {
        id: 'req-1',
        status: 'APPROVED' as TimeOffStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as TimeOffRequest;

      mockRequestRepository.findOne.mockResolvedValue(mockRequest);

      const result = await service.approve('req-1');

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Cannot approve');
    });
  });

  describe('reject', () => {
    it('should reject request and release days', async () => {
      const mockRequest: TimeOffRequest = {
        id: 'req-1',
        employeeId: 'EMP001',
        locationId: 'LOC001',
        days: 5,
        status: 'PENDING' as TimeOffStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as TimeOffRequest;

      mockRequestRepository.findOne.mockResolvedValue(mockRequest);
      mockRequestRepository.save.mockImplementation((entity) => Promise.resolve(entity));
      mockBalanceService.releaseDays.mockResolvedValue({
        available: 10,
        reserved: 0,
        used: 0,
      });

      const result = await service.reject('req-1', 'Not approved');

      expect(result.status).toBe('REJECTED');
      expect(result.reason).toBe('Not approved');
      expect(mockBalanceService.releaseDays).toHaveBeenCalled();
    });

    it('should throw ConflictException when request is not PENDING', async () => {
      const mockRequest: TimeOffRequest = {
        id: 'req-1',
        status: 'APPROVED' as TimeOffStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as TimeOffRequest;

      mockRequestRepository.findOne.mockResolvedValue(mockRequest);

      await expect(service.reject('req-1', 'Reason')).rejects.toThrow(ConflictException);
    });
  });

  describe('getByEmployee', () => {
    it('should return all requests for an employee', async () => {
      const mockRequests: TimeOffRequest[] = [
        {
          id: 'req-1',
          employeeId: 'EMP001',
          status: 'PENDING' as TimeOffStatus,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as TimeOffRequest,
      ];

      mockRequestRepository.find.mockResolvedValue(mockRequests);

      const result = await service.getByEmployee('EMP001');

      expect(result.length).toBe(1);
      expect(result[0].employeeId).toBe('EMP001');
    });
  });
});