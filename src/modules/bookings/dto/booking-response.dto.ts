import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';

export class PriceBreakdownDto {
  @ApiProperty()
  nights: number;

  @ApiProperty({ description: 'Total nightly charges (ARS)' })
  nightlyTotal: string;

  @ApiProperty({ description: 'Cleaning fee (ARS)' })
  cleaningFee: string;

  @ApiProperty({ description: 'Grand total (ARS)' })
  total: string;
}

export class BookingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  checkIn: Date;

  @ApiProperty()
  checkOut: Date;

  @ApiProperty()
  guests: number;

  @ApiProperty({ description: 'Total price in ARS' })
  totalPrice: string;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiPropertyOptional()
  specialRequests?: string;

  @ApiProperty()
  guestId: string;

  @ApiProperty()
  propertyId: string;

  @ApiPropertyOptional({ type: PriceBreakdownDto })
  priceBreakdown?: PriceBreakdownDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
