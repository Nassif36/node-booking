import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, GetQuoteDto } from './dto/create-booking.dto';
import { BookingResponseDto } from './dto/booking-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('bookings')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new booking (authenticated users only)' })
  @ApiResponse({ status: 201, description: 'Booking created successfully', type: BookingResponseDto })
  @ApiResponse({ status: 409, description: 'Dates are not available' })
  @ApiResponse({ status: 400, description: 'Validation or business rule error' })
  create(@CurrentUser('id') guestId: string, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(guestId, dto);
  }

  @Get('quote')
  @ApiOperation({ summary: 'Get a price quote for given dates without creating a booking' })
  @ApiResponse({ status: 200, description: 'Price breakdown' })
  getQuote(@Query() dto: GetQuoteDto) {
    return this.bookingsService.getQuote(dto);
  }

  @Get('my-bookings')
  @ApiOperation({ summary: 'List bookings for the authenticated guest' })
  @ApiResponse({ status: 200, type: [BookingResponseDto] })
  listMyBookings(@CurrentUser('id') guestId: string) {
    return this.bookingsService.listGuestBookings(guestId);
  }

  @Get('owner-bookings')
  @ApiOperation({ summary: 'List bookings for all properties owned by the current user' })
  @ApiResponse({ status: 200, type: [BookingResponseDto] })
  listOwnerBookings(@CurrentUser('id') ownerId: string) {
    return this.bookingsService.listOwnerBookings(ownerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a booking by ID (guest, property owner, or admin)' })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiResponse({ status: 200, type: BookingResponseDto })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.bookingsService.findOne(id, userId, userRole);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiResponse({ status: 200, description: 'Booking cancelled' })
  cancel(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.bookingsService.cancel(id, userId, userRole);
  }
}
