import { Test, TestingModule } from '@nestjs/testing';
import { LocationService } from './location.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Location } from './entities/location.entity';

describe('LocationService', () => {
  let service: LocationService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationService,
        {
          provide: getRepositoryToken(Location),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<LocationService>(LocationService);
    jest.clearAllMocks();
  });

  it('should create a location', async () => {
    const dto = {
      externalId: 'LOC001',
      name: 'São Paulo',
      timezone: 'America/Sao_Paulo',
    };

    mockRepository.create.mockReturnValue(dto);
    mockRepository.save.mockResolvedValue(dto);

    const result = await service.create(dto);

    expect(mockRepository.create).toHaveBeenCalledWith(dto);
    expect(mockRepository.save).toHaveBeenCalled();
    expect(result).toEqual(dto);
  });

  it('should return all locations', async () => {
    const locations = [
      { externalId: 'LOC001' },
      { externalId: 'LOC002' },
    ];

    mockRepository.find.mockResolvedValue(locations);

    const result = await service.getAll();

    expect(mockRepository.find).toHaveBeenCalled();
    expect(result).toEqual(locations);
  });

  it('should return location by externalId', async () => {
    const location = { externalId: 'LOC001' };

    mockRepository.findOne.mockResolvedValue(location);

    const result = await service.getByExternalId('LOC001');

    expect(mockRepository.findOne).toHaveBeenCalledWith({
      where: { externalId: 'LOC001' },
    });

    expect(result).toEqual(location);
  });

  it('should return null if location not found', async () => {
    mockRepository.findOne.mockResolvedValue(null);

    const result = await service.getByExternalId('NOT_FOUND');

    expect(result).toBeNull();
  });
});