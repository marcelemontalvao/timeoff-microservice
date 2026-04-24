import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './entities/employee.entity';

export interface CreateEmployeeDto {
  externalId: string;
  name: string;
  email: string;
  locationId?: string;
}

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
  ) {}

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    const existing = await this.employeeRepository.findOne({
      where: [{ externalId: dto.externalId }, { email: dto.email }],
    });

    if (existing) {
      throw new ConflictException('Employee with same externalId or email already exists');
    }

    const employee = this.employeeRepository.create(dto);
    return this.employeeRepository.save(employee);
  }

  async getAll(): Promise<Employee[]> {
    return this.employeeRepository.find();
  }

  async getByExternalId(externalId: string): Promise<Employee | null> {
    return this.employeeRepository.findOne({ where: { externalId } });
  }
}