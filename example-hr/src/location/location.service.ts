import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './entities/location.entity';

export interface CreateLocationDto {
  externalId: string;
  name: string;
  timezone: string;
}

@Injectable()
export class LocationService {
  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
  ) {}

  async create(dto: CreateLocationDto): Promise<Location> {
    const existing = await this.locationRepository.findOne({
      where: { externalId: dto.externalId },
    });

    if (existing) {
      throw new ConflictException('Location with same externalId already exists');
    }

    const location = this.locationRepository.create(dto);
    return this.locationRepository.save(location);
  }

  async getAll(): Promise<Location[]> {
    return this.locationRepository.find();
  }

  async getByExternalId(externalId: string): Promise<Location | null> {
    return this.locationRepository.findOne({ where: { externalId } });
  }
}