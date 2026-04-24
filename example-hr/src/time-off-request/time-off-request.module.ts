import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffRequestService } from './time-off-request.service';
import { TimeOffRequestController } from './time-off-request.controller';
import { TimeOffRequest } from './entities/time-off-request.entity';
import { BalanceModule } from '../balance/balance.module';
import { HcmMockModule } from '../hcm-mock/hcm-mock.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffRequest]),
    BalanceModule,
    HcmMockModule,
  ],
  controllers: [TimeOffRequestController],
  providers: [TimeOffRequestService],
  exports: [TimeOffRequestService, TypeOrmModule],
})
export class TimeOffRequestModule {}