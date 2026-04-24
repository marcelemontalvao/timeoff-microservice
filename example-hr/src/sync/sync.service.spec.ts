import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from './sync.service';
import { HcmMockService } from '../hcm-mock/hcm-mock.service';
import { BalanceService } from '../balance/balance.service';

describe('SyncService', () => {
  let service: SyncService;

  const mockHcmMockService = {
    getAllBalances: jest.fn(),
  };

  const mockBalanceService = {
    getBalance: jest.fn(),
    syncFromHcm: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        {
          provide: HcmMockService,
          useValue: mockHcmMockService,
        },
        {
          provide: BalanceService,
          useValue: mockBalanceService,
        },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);

    jest.clearAllMocks();
  });

  it('should sync valid HCM balances', async () => {
    mockHcmMockService.getAllBalances.mockResolvedValue([
      {
        employeeId: 'emp-uuid-1',
        locationId: 'loc-uuid-1',
        balance: 10,
        hcmVersion: 'v1',
      },
    ]);

    mockBalanceService.getBalance.mockResolvedValue({
      employeeId: 'emp-uuid-1',
      locationId: 'loc-uuid-1',
      available: 10,
      reserved: 0,
      used: 0,
    });

    mockBalanceService.syncFromHcm.mockResolvedValue({
      employeeId: 'emp-uuid-1',
      locationId: 'loc-uuid-1',
      available: 10,
      reserved: 0,
      used: 0,
    });

    const result = await service.runManualSync();

    expect(result.synced).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.conflicts).toHaveLength(0);

    expect(mockBalanceService.syncFromHcm).toHaveBeenCalledWith(
      'emp-uuid-1',
      'loc-uuid-1',
      10,
      'v1',
    );
  });

  it('should skip invalid HCM balances without failing the whole sync', async () => {
    mockHcmMockService.getAllBalances.mockResolvedValue([
      {
        employeeId: 'EMP001',
        locationId: 'LOC001',
        balance: 15,
        hcmVersion: 'legacy-v1',
      },
    ]);

    mockBalanceService.getBalance.mockRejectedValue(
      new Error('Foreign key constraint failed'),
    );

    const result = await service.runManualSync();

    expect(result.synced).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.conflicts).toHaveLength(0);
    expect(mockBalanceService.syncFromHcm).not.toHaveBeenCalled();
  });

  it('should detect conflicts between local and HCM balances', async () => {
    mockHcmMockService.getAllBalances.mockResolvedValue([
      {
        employeeId: 'emp-uuid-1',
        locationId: 'loc-uuid-1',
        balance: 15,
        hcmVersion: 'v2',
      },
    ]);

    mockBalanceService.getBalance.mockResolvedValue({
      employeeId: 'emp-uuid-1',
      locationId: 'loc-uuid-1',
      available: 10,
      reserved: 0,
      used: 0,
    });

    mockBalanceService.syncFromHcm.mockResolvedValue({
      employeeId: 'emp-uuid-1',
      locationId: 'loc-uuid-1',
      available: 15,
      reserved: 0,
      used: 0,
    });

    const result = await service.runManualSync();

    expect(result.synced).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toEqual({
      employeeId: 'emp-uuid-1',
      locationId: 'loc-uuid-1',
      localTotalBalance: 10,
      hcmBalance: 15,
      difference: 5,
    });
  });

  it('should sync multiple balances and continue after one failure', async () => {
    mockHcmMockService.getAllBalances.mockResolvedValue([
      {
        employeeId: 'emp-uuid-1',
        locationId: 'loc-uuid-1',
        balance: 10,
        hcmVersion: 'v1',
      },
      {
        employeeId: 'EMP_LEGACY',
        locationId: 'LOC_LEGACY',
        balance: 20,
        hcmVersion: 'legacy-v1',
      },
      {
        employeeId: 'emp-uuid-2',
        locationId: 'loc-uuid-2',
        balance: 8,
        hcmVersion: 'v1',
      },
    ]);

    mockBalanceService.getBalance
      .mockResolvedValueOnce({
        employeeId: 'emp-uuid-1',
        locationId: 'loc-uuid-1',
        available: 10,
        reserved: 0,
        used: 0,
      })
      .mockRejectedValueOnce(new Error('Invalid HCM record'))
      .mockResolvedValueOnce({
        employeeId: 'emp-uuid-2',
        locationId: 'loc-uuid-2',
        available: 8,
        reserved: 0,
        used: 0,
      });

    mockBalanceService.syncFromHcm.mockResolvedValue({
      available: 10,
      reserved: 0,
      used: 0,
    });

    const result = await service.runManualSync();

    expect(result.synced).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.conflicts).toHaveLength(0);
    expect(mockBalanceService.syncFromHcm).toHaveBeenCalledTimes(2);
  });

  it('scheduled sync should delegate to manual sync', async () => {
    mockHcmMockService.getAllBalances.mockResolvedValue([]);

    await service.syncBalancesFromHcm();

    expect(mockHcmMockService.getAllBalances).toHaveBeenCalled();
  });
});