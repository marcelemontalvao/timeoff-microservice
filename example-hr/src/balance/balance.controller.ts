import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { BalanceService, BalanceResponse } from './balance.service';
import { Balance } from './entities/balance.entity';

class SyncBalanceBody {
  @IsString()
  employeeId!: string;

  @IsString()
  locationId!: string;

  @IsNumber()
  balance!: number;

  @IsOptional()
  @IsString()
  hcmVersion?: string;
}

@Controller('balances')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get()
  getAll(): Promise<Balance[]> {
    return this.balanceService.getAllBalances();
  }

  @Get(':employeeId/:locationId')
  getBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ): Promise<BalanceResponse> {
    return this.balanceService.getBalance(employeeId, locationId);
  }

  @Post('sync')
  syncFromHcm(@Body() body: SyncBalanceBody): Promise<BalanceResponse> {
    return this.balanceService.syncFromHcm(
      body.employeeId,
      body.locationId,
      body.balance,
      body.hcmVersion,
    );
  }
}