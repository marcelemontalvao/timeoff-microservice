import { Controller, Get, Post, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { IsString, IsNumber, IsDateString } from 'class-validator';
import { HcmMockService, SubmitTimeOffResult } from './hcm-mock.service';

export class GetBalanceResponse {
  @IsString()
  employeeId!: string;

  @IsString()
  locationId!: string;

  @IsNumber()
  balance!: number;

  @IsString()
  hcmVersion?: string;

  @IsString()
  updatedAt!: string;
}

export class SubmitTimeOffDto {
  @IsString()
  employeeId!: string;

  @IsString()
  locationId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsNumber()
  days!: number;
}

export class BatchBalanceResponse {
  balances!: GetBalanceResponse[];
  total!: number;
  timestamp!: string;
}

@Controller('hcm')
export class HcmMockController {
  constructor(private readonly hcmMockService: HcmMockService) {}

  /**
   * GET /hcm/balance/:employeeId/:locationId
   * Get balance for a specific employee+location
   */
  @Get('balance/:employeeId/:locationId')
  @HttpCode(HttpStatus.OK)
  async getBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ): Promise<GetBalanceResponse> {
    const balance = await this.hcmMockService.getBalance(employeeId, locationId);
    
    return {
      employeeId: balance.employeeId,
      locationId: balance.locationId,
      balance: balance.balance,
      hcmVersion: balance.hcmVersion,
      updatedAt: balance.updatedAt.toISOString(),
    };
  }

  /**
   * POST /hcm/time-off
   * Submit time-off request to HCM
   */
  @Post('time-off')
  @HttpCode(HttpStatus.OK)
  async submitTimeOff(
    @Body() dto: SubmitTimeOffDto,
  ): Promise<SubmitTimeOffResult> {
    return this.hcmMockService.submitTimeOff(
      dto.employeeId,
      dto.locationId,
      dto.startDate,
      dto.endDate,
      dto.days,
    );
  }

  /**
   * GET /hcm/batch
   * Get all balances (Batch endpoint)
   */
  @Get('batch')
  @HttpCode(HttpStatus.OK)
  async getBatchBalances(): Promise<BatchBalanceResponse> {
    const balances = await this.hcmMockService.getAllBalances();
    
    return {
      balances: balances.map((b) => ({
        employeeId: b.employeeId,
        locationId: b.locationId,
        balance: b.balance,
        hcmVersion: b.hcmVersion,
        updatedAt: b.updatedAt.toISOString(),
      })),
      total: balances.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * POST /hcm/seed
   * Seed test data (for development/testing)
   */
  @Post('seed')
  @HttpCode(HttpStatus.OK)
  async seedTestData(): Promise<{ message: string }> {
    await this.hcmMockService.seedTestData();
    return { message: 'Test data seeded successfully' };
  }
}