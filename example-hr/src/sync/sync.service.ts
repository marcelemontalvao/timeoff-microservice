import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HcmMockService } from '../hcm-mock/hcm-mock.service';
import { BalanceService } from '../balance/balance.service';

export interface SyncConflict {
  employeeId: string;
  locationId: string;
  localTotalBalance: number;
  hcmBalance: number;
  difference: number;
}

export interface SyncResult {
  synced: number;
  skipped: number;
  conflicts: SyncConflict[];
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly hcmMockService: HcmMockService,
    private readonly balanceService: BalanceService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async syncBalancesFromHcm(): Promise<void> {
    await this.runManualSync();
  }

  async runManualSync(): Promise<SyncResult> {
    const balances = await this.hcmMockService.getAllBalances();

    let synced = 0;
    let skipped = 0;
    const conflicts: SyncConflict[] = [];

    for (const hcmBalance of balances) {
      try {
        const localBalance = await this.balanceService.getBalance(
          hcmBalance.employeeId,
          hcmBalance.locationId,
        );

        const localTotalBalance =
          localBalance.available + localBalance.reserved + localBalance.used;

        if (localTotalBalance !== hcmBalance.balance) {
          conflicts.push({
            employeeId: hcmBalance.employeeId,
            locationId: hcmBalance.locationId,
            localTotalBalance,
            hcmBalance: hcmBalance.balance,
            difference: hcmBalance.balance - localTotalBalance,
          });
        }

        await this.balanceService.syncFromHcm(
          hcmBalance.employeeId,
          hcmBalance.locationId,
          hcmBalance.balance,
          hcmBalance.hcmVersion,
        );

        synced += 1;
      } catch {
        skipped += 1;

        this.logger.warn(
          `Skipped HCM balance sync for employeeId=${hcmBalance.employeeId}, locationId=${hcmBalance.locationId}`,
        );
      }
    }

    this.logger.log(
      `HCM sync completed. Synced=${synced}, skipped=${skipped}, conflicts=${conflicts.length}`,
    );

    return { synced, skipped, conflicts };
  }
}