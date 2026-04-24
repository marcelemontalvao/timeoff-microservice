import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { HcmMockModule } from '../hcm-mock/hcm-mock.module';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [HcmMockModule, BalanceModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}