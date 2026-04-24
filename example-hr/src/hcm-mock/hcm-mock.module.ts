import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HcmMockController } from './hcm-mock.controller';
import { HcmMockService } from './hcm-mock.service';
import { HcmBalance } from './entities/hcm-balance.entity';
import { HcmTimeOffRequest } from './entities/hcm-time-off-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([HcmBalance, HcmTimeOffRequest]),
  ],
  controllers: [HcmMockController],
  providers: [HcmMockService],
  exports: [HcmMockService, TypeOrmModule],
})
export class HcmMockModule {}