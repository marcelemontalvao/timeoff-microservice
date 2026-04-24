import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import { LocationService } from './location.service';
import { Location } from './entities/location.entity';

class CreateLocationBody {
  @IsString()
  externalId!: string;

  @IsString()
  name!: string;

  @IsString()
  timezone!: string;
}

@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Post()
  create(@Body() body: CreateLocationBody): Promise<Location> {
    return this.locationService.create(body);
  }

  @Get()
  getAll(): Promise<Location[]> {
    return this.locationService.getAll();
  }

  @Get(':externalId')
  getByExternalId(@Param('externalId') externalId: string): Promise<Location | null> {
    return this.locationService.getByExternalId(externalId);
  }
}