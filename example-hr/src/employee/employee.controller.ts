import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { EmployeeService } from './employee.service';
import { Employee } from './entities/employee.entity';

class CreateEmployeeBody {
  @IsString()
  externalId!: string;

  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  locationId?: string;
}

@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  create(@Body() body: CreateEmployeeBody): Promise<Employee> {
    return this.employeeService.create(body);
  }

  @Get()
  getAll(): Promise<Employee[]> {
    return this.employeeService.getAll();
  }

  @Get(':externalId')
  getByExternalId(@Param('externalId') externalId: string): Promise<Employee | null> {
    return this.employeeService.getByExternalId(externalId);
  }
}