import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffRequest, TimeOffStatus } from './entities/time-off-request.entity';
import { BalanceService } from '../balance/balance.service';
import { HcmMockService } from '../hcm-mock/hcm-mock.service';

export interface CreateTimeOffRequestDto {
  employeeId: string;
  locationId: string;
  startDate: string;
  endDate: string;
  days: number;
  idempotencyKey?: string;
}

export interface TimeOffRequestResponse {
  id: string;
  employeeId: string;
  locationId: string;
  startDate: string;
  endDate: string;
  days: number;
  status: TimeOffStatus;
  reason?: string;
  localApproval: boolean;
  hcmApproved: boolean;
  createdAt: Date;
}

export interface ApproveResult {
  success: boolean;
  request?: TimeOffRequestResponse;
  errorMessage?: string;
}

@Injectable()
export class TimeOffRequestService {
  constructor(
    @InjectRepository(TimeOffRequest)
    private timeOffRequestRepository: Repository<TimeOffRequest>,
    private balanceService: BalanceService,
    private hcmMockService: HcmMockService,
  ) {}

  /**
   * Create a new time-off request
   * 1. Check local balance (optimistic)
   * 2. Reserve days locally
   * 3. Create request with PENDING status
   */
  async create(dto: CreateTimeOffRequestDto): Promise<TimeOffRequestResponse> {
    // Check idempotency
    if (dto.idempotencyKey) {
      const existing = await this.timeOffRequestRepository.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return this.toResponse(existing);
      }
    }

    // Validate dates
    if (new Date(dto.startDate) > new Date(dto.endDate)) {
      throw new BadRequestException('Start date must be before end date');
    }

    if (dto.days <= 0) {
      throw new BadRequestException('Days must be greater than 0');
    }

    // Reserve days locally (optimistic check)
    const reserveResult = await this.balanceService.reserveDays(
      dto.employeeId,
      dto.locationId,
      dto.days,
      '',
      dto.idempotencyKey,
    );

    if (!reserveResult.success) {
      throw new ConflictException(reserveResult.errorMessage);
    }

    // Create request
    const request = this.timeOffRequestRepository.create({
      employeeId: dto.employeeId,
      locationId: dto.locationId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      days: dto.days,
      status: 'PENDING' as TimeOffStatus,
      localApproval: false,
      hcmApproved: false,
      idempotencyKey: dto.idempotencyKey,
    });

    await this.timeOffRequestRepository.save(request);
    return this.toResponse(request);
  }

  /**
   * Get request by ID
   */
  async getById(id: string): Promise<TimeOffRequestResponse> {
    const request = await this.timeOffRequestRepository.findOne({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`Time-off request ${id} not found`);
    }

    return this.toResponse(request);
  }

  /**
   * Get all requests for an employee
   */
  async getByEmployee(employeeId: string): Promise<TimeOffRequestResponse[]> {
    const requests = await this.timeOffRequestRepository.find({
      where: { employeeId },
      order: { createdAt: 'DESC' },
    });

    return requests.map((r) => this.toResponse(r));
  }

  /**
   * Manager approves a request
   * 1. Mark as locally approved
   * 2. Send to HCM for validation
   * 3. On success: commit reserved days to used
   * 4. On failure: release reserved days
   */
  async approve(id: string): Promise<ApproveResult> {
    const request = await this.timeOffRequestRepository.findOne({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`Time-off request ${id} not found`);
    }

    if (request.status !== 'PENDING') {
      return {
        success: false,
        errorMessage: `Cannot approve request with status ${request.status}`,
      };
    }

    // Update status to HCM_SYNCING
    request.status = 'HCM_SYNCING' as TimeOffStatus;
    request.localApproval = true;
    await this.timeOffRequestRepository.save(request);

    // Send to HCM
    const hcmResult = await this.hcmMockService.submitTimeOff(
      request.employeeId,
      request.locationId,
      request.startDate,
      request.endDate,
      request.days,
    );

    if (hcmResult.success) {
      // HCM approved
      request.status = 'APPROVED' as TimeOffStatus;
      request.hcmApproved = true;
      request.hcmResponseId = hcmResult.requestId;
      await this.timeOffRequestRepository.save(request);

      // Commit reserved days to used
      await this.balanceService.commitDays(
        request.employeeId,
        request.locationId,
        request.days,
      );

      return {
        success: true,
        request: this.toResponse(request),
      };
    } else {
      // HCM rejected
      request.status = 'REJECTED' as TimeOffStatus;
      request.reason = hcmResult.errorMessage;
      request.hcmResponseId = hcmResult.requestId;
      await this.timeOffRequestRepository.save(request);

      // Release reserved days
      await this.balanceService.releaseDays(
        request.employeeId,
        request.locationId,
        request.days,
      );

      return {
        success: false,
        request: this.toResponse(request),
        errorMessage: hcmResult.errorMessage,
      };
    }
  }

  /**
   * Manager rejects a request
   */
  async reject(id: string, reason: string): Promise<TimeOffRequestResponse> {
    const request = await this.timeOffRequestRepository.findOne({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`Time-off request ${id} not found`);
    }

    if (request.status !== 'PENDING') {
      throw new ConflictException(`Cannot reject request with status ${request.status}`);
    }

    request.status = 'REJECTED' as TimeOffStatus;
    request.reason = reason;
    await this.timeOffRequestRepository.save(request);

    // Release reserved days
    await this.balanceService.releaseDays(
      request.employeeId,
      request.locationId,
      request.days,
    );

    return this.toResponse(request);
  }

  /**
   * Convert entity to response DTO
   */
  private toResponse(entity: TimeOffRequest): TimeOffRequestResponse {
    return {
      id: entity.id,
      employeeId: entity.employeeId,
      locationId: entity.locationId,
      startDate: entity.startDate,
      endDate: entity.endDate,
      days: entity.days,
      status: entity.status,
      reason: entity.reason,
      localApproval: entity.localApproval,
      hcmApproved: entity.hcmApproved,
      createdAt: entity.createdAt,
    };
  }

  /**
   * Get all requests (for admin)
   */
  async getAll(): Promise<TimeOffRequestResponse[]> {
    const requests = await this.timeOffRequestRepository.find({
      order: { createdAt: 'DESC' },
    });

    return requests.map((r) => this.toResponse(r));
  }
}