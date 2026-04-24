import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HcmBalance } from './entities/hcm-balance.entity';
import { HcmTimeOffRequest, HcmRequestStatus } from './entities/hcm-time-off-request.entity';
import { v4 as uuidv4 } from 'uuid';

// Configurable timeout delay (default 11s, can be overridden for tests)
let timeoutDelay = 11000;

// Failure mode probabilities
const FAILURE_MODES = {
  SUCCESS: 0.7,           // 70% - Normal response
  BALANCE_NOT_ENOUGH: 0.1, // 10% - Return error "Insufficient balance"
  RANDOM_FAILURE: 0.1,     // 10% - Return 500 Internal Server Error
  TIMEOUT: 0.05,          // 5% - Delay response by configured timeout
  SILENT_IGNORE: 0.05,    // 5% - Return success but not deduct balance
};

export interface SubmitTimeOffResult {
  success: boolean;
  requestId?: string;
  errorMessage?: string;
  balanceDeducted?: boolean;
}

/**
 * Set the timeout delay for testing (in milliseconds)
 */
export function setTimeoutDelay(delay: number): void {
  timeoutDelay = delay;
}

/**
 * Get the current timeout delay
 */
export function getTimeoutDelay(): number {
  return timeoutDelay;
}

@Injectable()
export class HcmMockService {
  constructor(
    @InjectRepository(HcmBalance)
    private balanceRepository: Repository<HcmBalance>,
    @InjectRepository(HcmTimeOffRequest)
    private requestRepository: Repository<HcmTimeOffRequest>,
  ) {}

  /**
   * Get balance for a specific employee+location
   */
  async getBalance(employeeId: string, locationId: string): Promise<HcmBalance> {
    let balance = await this.balanceRepository.findOne({
      where: { employeeId, locationId },
    });

    if (!balance) {
      // Create default balance if not exists (simulating HCM having data)
      balance = this.balanceRepository.create({
        employeeId,
        locationId,
        balance: 10, // Default 10 days
        hcmVersion: uuidv4(),
      });
      await this.balanceRepository.save(balance);
    }

    return balance;
  }

  /**
   * Get all balances (Batch endpoint)
   */
  async getAllBalances(): Promise<HcmBalance[]> {
    return this.balanceRepository.find();
  }

  /**
   * Submit time-off request to HCM
   * Simulates various failure modes
   */
  async submitTimeOff(
    employeeId: string,
    locationId: string,
    startDate: string,
    endDate: string,
    days: number,
  ): Promise<SubmitTimeOffResult> {
    // Determine failure mode
    const random = Math.random();
    let failureMode: string = 'SUCCESS';
    let cumulative = 0;

    for (const [mode, probability] of Object.entries(FAILURE_MODES)) {
      cumulative += probability;
      if (random <= cumulative) {
        failureMode = mode;
        break;
      }
    }

    // Handle each failure mode
    switch (failureMode) {
      case 'BALANCE_NOT_ENOUGH': {
        // Create request record with error
        const request = this.requestRepository.create({
          employeeId,
          locationId,
          startDate,
          endDate,
          days,
          status: 'REJECTED' as HcmRequestStatus,
          errorMessage: 'Insufficient balance in HCM system',
        });
        await this.requestRepository.save(request);

        return {
          success: false,
          requestId: request.id,
          errorMessage: 'Insufficient balance',
          balanceDeducted: false,
        };
      }

      case 'RANDOM_FAILURE': {
        throw new ServiceUnavailableException('HCM system temporarily unavailable');
      }

      case 'TIMEOUT': {
        // Simulate timeout by delaying (configurable for tests)
        await new Promise((resolve) => setTimeout(resolve, timeoutDelay));
        throw new ServiceUnavailableException('HCM system timeout');
      }

      case 'SILENT_IGNORE': {
        // Return success but don't deduct balance
        const request = this.requestRepository.create({
          employeeId,
          locationId,
          startDate,
          endDate,
          days,
          status: 'APPROVED' as HcmRequestStatus,
        });
        await this.requestRepository.save(request);

        return {
          success: true,
          requestId: request.id,
          balanceDeducted: false, // Silent ignore - not deducted
        };
      }

      case 'SUCCESS':
      default: {
        // Normal flow: deduct balance and approve
        const balance = await this.getBalance(employeeId, locationId);
        
        if (balance.balance < days) {
          const request = this.requestRepository.create({
            employeeId,
            locationId,
            startDate,
            endDate,
            days,
            status: 'REJECTED' as HcmRequestStatus,
            errorMessage: 'Insufficient balance',
          });
          await this.requestRepository.save(request);

          return {
            success: false,
            requestId: request.id,
            errorMessage: 'Insufficient balance',
            balanceDeducted: false,
          };
        }

        // Deduct balance
        balance.balance -= days;
        balance.hcmVersion = uuidv4();
        await this.balanceRepository.save(balance);

        // Create approved request
        const request = this.requestRepository.create({
          employeeId,
          locationId,
          startDate,
          endDate,
          days,
          status: 'APPROVED' as HcmRequestStatus,
        });
        await this.requestRepository.save(request);

        return {
          success: true,
          requestId: request.id,
          balanceDeducted: true,
        };
      }
    }
  }

  /**
   * Update balance externally (simulating external changes)
   */
  async updateBalanceExternally(
    employeeId: string,
    locationId: string,
    newBalance: number,
  ): Promise<HcmBalance> {
    let balance = await this.balanceRepository.findOne({
      where: { employeeId, locationId },
    });

    if (balance) {
      balance.balance = newBalance;
      balance.hcmVersion = uuidv4();
    } else {
      balance = this.balanceRepository.create({
        employeeId,
        locationId,
        balance: newBalance,
        hcmVersion: uuidv4(),
      });
    }

    return this.balanceRepository.save(balance);
  }

  /**
   * Seed initial data for testing
   */
  async seedTestData(): Promise<void> {
    const testData = [
      { employeeId: 'EMP001', locationId: 'LOC001', balance: 15 },
      { employeeId: 'EMP002', locationId: 'LOC001', balance: 10 },
      { employeeId: 'EMP003', locationId: 'LOC002', balance: 20 },
      { employeeId: 'EMP004', locationId: 'LOC002', balance: 5 },
      { employeeId: 'EMP005', locationId: 'LOC001', balance: 12 },
    ];

    for (const data of testData) {
      await this.updateBalanceExternally(data.employeeId, data.locationId, data.balance);
    }
  }
}