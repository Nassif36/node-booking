import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSeasonalPricingDto {
  @ApiProperty({ example: '2025-12-20', description: 'Period start date (YYYY-MM-DD, inclusive)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-01-05', description: 'Period end date (YYYY-MM-DD, inclusive)' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 25000, description: 'Price per night during this period (ARS)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  pricePerNight: number;

  @ApiPropertyOptional({ example: 'Temporada alta – Navidad y Año Nuevo' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
