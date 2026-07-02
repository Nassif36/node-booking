import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsString,
  MaxLength,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBookingDto {
  @ApiProperty({ description: 'UUID of the property to book' })
  @IsUUID()
  propertyId: string;

  @ApiProperty({ example: '2026-08-01', description: 'Check-in date (YYYY-MM-DD)' })
  @IsDateString()
  checkIn: string;

  @ApiProperty({ example: '2026-08-08', description: 'Check-out date (YYYY-MM-DD)' })
  @IsDateString()
  checkOut: string;

  @ApiProperty({ example: 2, description: 'Number of guests' })
  @IsNumber()
  @IsPositive()
  @Max(20)
  @Type(() => Number)
  guests: number;

  @ApiPropertyOptional({ example: 'Por favor, dejen las llaves en la recepción del edificio.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialRequests?: string;
}

export class GetQuoteDto extends CreateBookingDto {}
