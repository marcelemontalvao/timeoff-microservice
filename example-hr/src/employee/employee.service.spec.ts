import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeService } from './employee.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity';

describe('EmployeeService', () => {
  let service: EmployeeService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        {
          provide: getRepositoryToken(Employee),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
    jest.clearAllMocks();
  });

  it('should create an employee', async () => {
    const dto = {
      externalId: 'EMP001',
      name: 'Marcele',
      email: 'marcele@test.com',
      locationId: 'LOC001',
    };

    mockRepository.create.mockReturnValue(dto);
    mockRepository.save.mockResolvedValue(dto);

    const result = await service.create(dto);

    expect(mockRepository.create).toHaveBeenCalledWith(dto);
    expect(mockRepository.save).toHaveBeenCalled();
    expect(result).toEqual(dto);
  });

  it('should return all employees', async () => {
    const employees = [
      { externalId: 'EMP001' },
      { externalId: 'EMP002' },
    ];

    mockRepository.find.mockResolvedValue(employees);

    const result = await service.getAll();

    expect(mockRepository.find).toHaveBeenCalled();
    expect(result).toEqual(employees);
  });

  it('should return employee by externalId', async () => {
    const employee = { externalId: 'EMP001' };

    mockRepository.findOne.mockResolvedValue(employee);

    const result = await service.getByExternalId('EMP001');

    expect(mockRepository.findOne).toHaveBeenCalledWith({
      where: { externalId: 'EMP001' },
    });

    expect(result).toEqual(employee);
  });

  it('should return null if employee not found', async () => {
    mockRepository.findOne.mockResolvedValue(null);

    const result = await service.getByExternalId('NOT_FOUND');

    expect(result).toBeNull();
  });
});