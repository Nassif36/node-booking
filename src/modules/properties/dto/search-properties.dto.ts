import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  Min,
  Max,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchPropertiesDto {
  @ApiPropertyOptional({ example: 'Buenos Aires', description: 'Filter by city (case-insensitive)' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Patagonia', description: 'Filter by province (case-insensitive)' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ example: '2025-07-01', description: 'Check-in date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @ApiPropertyOptional({ example: '2025-07-08', description: 'Check-out date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  checkOut?: string;

  @ApiPropertyOptional({ example: 2, description: 'Number of guests (filters by maxGuests)' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(20)
  @Type(() => Number)
  guests?: number;

  @ApiPropertyOptional({ example: 5000, description: 'Minimum base price per night (ARS)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional({ example: 50000, description: 'Maximum base price per night (ARS)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Page number' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 10, default: 10, description: 'Results per page (max 50)' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(50)
  @Type(() => Number)
  limit?: number;
}
