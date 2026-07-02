import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsPositive,
  MinLength,
  MaxLength,
  Min,
  Max,
  IsLatitude,
  IsLongitude,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePropertyDto {
  @ApiProperty({ example: 'Hermoso Departamento en Palermo Soho' })
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  title: string;

  @ApiProperty({ example: 'Luminoso departamento de 2 ambientes a metros del Parque Las Heras...' })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description: string;

  @ApiProperty({ example: 'Thames 1234, Palermo Soho' })
  @IsString()
  address: string;

  @ApiProperty({ example: 'Buenos Aires' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'Buenos Aires' })
  @IsString()
  province: string;

  @ApiPropertyOptional({ example: 'Argentina', default: 'Argentina' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: -34.5929, description: 'Decimal latitude' })
  @IsOptional()
  @IsLatitude()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({ example: -58.4126, description: 'Decimal longitude' })
  @IsOptional()
  @IsLongitude()
  @Type(() => Number)
  longitude?: number;

  @ApiProperty({ example: 15000, description: 'Base price per night in ARS' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  basePrice: number;

  @ApiPropertyOptional({ example: 3000, description: 'One-time cleaning fee in ARS' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  cleaningFee?: number;

  @ApiProperty({ example: 4, description: 'Maximum number of guests' })
  @IsNumber()
  @IsPositive()
  @Max(20)
  @Type(() => Number)
  maxGuests: number;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsPositive()
  @Max(10)
  @Type(() => Number)
  bedrooms: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsPositive()
  @Max(10)
  @Type(() => Number)
  bathrooms: number;

  @ApiPropertyOptional({
    example: ['WiFi', 'Aire acondicionado', 'Pileta', 'Estacionamiento'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}
