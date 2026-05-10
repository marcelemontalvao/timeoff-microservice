import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HcmMockModule } from './hcm-mock/hcm-mock.module';
import { HcmBalance } from './hcm-mock/entities/hcm-balance.entity';
import { HcmTimeOffRequest } from './hcm-mock/entities/hcm-time-off-request.entity';
import { Employee } from './employee/entities/employee.entity';
import { Location } from './location/entities/location.entity';
import { Balance } from './balance/entities/balance.entity';
import { TimeOffRequest } from './time-off-request/entities/time-off-request.entity';
import { EmployeeModule } from './employee/employee.module';
import { LocationModule } from './location/location.module';
import { BalanceModule } from './balance/balance.module';
import { TimeOffRequestModule } from './time-off-request/time-off-request.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'example-hr.db',
      entities: [
        HcmBalance,
        HcmTimeOffRequest,
        Employee,
        Location,
        Balance,
        TimeOffRequest,
      ],
      synchronize: true,
      logging: false,
    }),
    HcmMockModule,
    EmployeeModule,
    LocationModule,
    BalanceModule,
    TimeOffRequestModule,
    ScheduleModule.forRoot(),
    SyncModule,
  ],
})
export class AppModule {}
