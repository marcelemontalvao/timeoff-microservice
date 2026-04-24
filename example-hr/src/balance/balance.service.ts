import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Balance } from './entities/balance.entity';

export interface BalanceResponse {
  employeeId: string;
  locationId: string;
  available: number;
  reserved: number;
  used: number;
  lastSyncedAt?: Date;
}

export interface ReserveBalanceResult {
  success: boolean;
  balance?: BalanceResponse;
  errorMessage?: string;
}

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(Balance)
    private balanceRepository: Repository<Balance>,
  ) {}

  private toResponse(balance: Balance): BalanceResponse {
    return {
      employeeId: balance.employeeId,
      locationId: balance.locationId,
      available: balance.balance - balance.reserved - balance.used,
      reserved: balance.reserved,
      used: balance.used,
      lastSyncedAt: balance.lastSyncedAt,
    };
  }

  async getBalance(employeeId: string, locationId: string): Promise<BalanceResponse> {
    let balance = await this.balanceRepository.findOne({
      where: { employeeId, locationId },
    });

    if (!balance) {
      balance = this.balanceRepository.create({
        employeeId,
        locationId,
        balance: 0,
        reserved: 0,
        used: 0,
      });

      balance = await this.balanceRepository.save(balance);
    }

    return this.toResponse(balance);
  }

  async reserveDays(
    employeeId: string,
    locationId: string,
    days: number,
    requestId: string,
    idempotencyKey?: string,
  ): Promise<ReserveBalanceResult> {
    if (idempotencyKey) {
      const existing = await this.balanceRepository.findOne({
        where: { idempotencyKey },
      });

      if (existing) {
        return {
          success: true,
          balance: await this.getBalance(employeeId, locationId),
        };
      }
    }

    let balance = await this.balanceRepository.findOne({
      where: { employeeId, locationId },
    });

    if (!balance) {
      balance = this.balanceRepository.create({
        employeeId,
        locationId,
        balance: 0,
        reserved: 0,
        used: 0,
        idempotencyKey,
      });

      balance = await this.balanceRepository.save(balance);
    }

    const available = balance.balance - balance.reserved - balance.used;

    if (available < days) {
      return {
        success: false,
        errorMessage: `Insufficient balance. Available: ${available}, Requested: ${days}`,
      };
    }

    balance.reserved += days;

    if (idempotencyKey) {
      balance.idempotencyKey = idempotencyKey;
    }

    await this.balanceRepository.save(balance);

    return {
      success: true,
      balance: await this.getBalance(employeeId, locationId),
    };
  }

  async releaseDays(employeeId: string, locationId: string, days: number): Promise<BalanceResponse> {
    const balance = await this.balanceRepository.findOne({
      where: { employeeId, locationId },
    });

    if (!balance) {
      throw new NotFoundException(`Balance not found for employee ${employeeId}`);
    }

    balance.reserved = Math.max(0, balance.reserved - days);
    await this.balanceRepository.save(balance);

    return this.getBalance(employeeId, locationId);
  }

  async commitDays(employeeId: string, locationId: string, days: number): Promise<BalanceResponse> {
    const balance = await this.balanceRepository.findOne({
      where: { employeeId, locationId },
    });

    if (!balance) {
      throw new NotFoundException(`Balance not found for employee ${employeeId}`);
    }

    if (balance.reserved < days) {
      throw new ConflictException(`Cannot commit ${days} days. Reserved: ${balance.reserved}`);
    }

    balance.reserved -= days;
    balance.used += days;

    await this.balanceRepository.save(balance);

    return this.getBalance(employeeId, locationId);
  }

  async syncFromHcm(
    employeeId: string,
    locationId: string,
    hcmBalance: number,
    hcmVersion?: string,
  ): Promise<BalanceResponse> {
    let balance = await this.balanceRepository.findOne({
      where: { employeeId, locationId },
    });

    if (balance) {
      balance.balance = hcmBalance;
      balance.hcmVersion = hcmVersion ?? balance.hcmVersion;
      balance.lastSyncedAt = new Date();

      await this.balanceRepository.save(balance);
    } else {
      balance = this.balanceRepository.create({
        employeeId,
        locationId,
        balance: hcmBalance,
        reserved: 0,
        used: 0,
        hcmVersion,
        lastSyncedAt: new Date(),
      });

      await this.balanceRepository.save(balance);
    }

    return this.getBalance(employeeId, locationId);
  }

  async getAllBalances(): Promise<Balance[]> {
    return this.balanceRepository.find();
  }
}