import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';
import {
  ApproveResult,
  CreateTimeOffRequestDto,
  TimeOffRequestResponse,
  TimeOffRequestService,
} from './time-off-request.service';

class CreateTimeOffRequestBody implements CreateTimeOffRequestDto {
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

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

class RejectTimeOffRequestBody {
  @IsString()
  reason!: string;
}

@Controller('time-off-requests')
export class TimeOffRequestController {
  constructor(private readonly timeOffRequestService: TimeOffRequestService) {}

  @Post()
  create(@Body() body: CreateTimeOffRequestBody): Promise<TimeOffRequestResponse> {
    return this.timeOffRequestService.create(body);
  }

  @Get()
  getAll(): Promise<TimeOffRequestResponse[]> {
    return this.timeOffRequestService.getAll();
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<TimeOffRequestResponse> {
    return this.timeOffRequestService.getById(id);
  }

  @Get('employee/:employeeId')
  getByEmployee(
    @Param('employeeId') employeeId: string,
  ): Promise<TimeOffRequestResponse[]> {
    return this.timeOffRequestService.getByEmployee(employeeId);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string): Promise<ApproveResult> {
    return this.timeOffRequestService.approve(id);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() body: RejectTimeOffRequestBody,
  ): Promise<TimeOffRequestResponse> {
    return this.timeOffRequestService.reject(id, body.reason);
  }
}