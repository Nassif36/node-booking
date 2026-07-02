import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { BookingStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingService } from './services/pricing.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
  ) {}

  async create(guestId: string, dto: CreateBookingDto) {
    const checkIn = new Date(dto.checkIn);
    const checkOut = new Date(dto.checkOut);

    // Standardise check-in/out times (14:00 / 11:00 AR local → stored as UTC)
    checkIn.setHours(14, 0, 0, 0);
    checkOut.setHours(11, 0, 0, 0);

    if (checkIn <= new Date()) {
      throw new BadRequestException('Check-in date must be in the future');
    }

    if (checkIn >= checkOut) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    return this.prisma.$transaction(async (tx) => {
      // Advisory lock – prevents concurrent bookings on the same property
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.propertyId}))`;

      const property = await tx.property.findUnique({
        where: { id: dto.propertyId, isActive: true },
        include: { seasonalPricings: true },
      });

      if (!property) {
        throw new NotFoundException('Property not found or unavailable');
      }

      if (property.ownerId === guestId) {
        throw new BadRequestException('You cannot book your own property');
      }

      if (dto.guests > property.maxGuests) {
        throw new BadRequestException(
          `This property allows a maximum of ${property.maxGuests} guests`,
        );
      }

      // Check for overlapping confirmed or pending bookings
      const overlap = await tx.booking.findFirst({
        where: {
          propertyId: dto.propertyId,
          status: { notIn: [BookingStatus.CANCELLED] },
          AND: [{ checkIn: { lt: checkOut } }, { checkOut: { gt: checkIn } }],
        },
      });

      if (overlap) {
        throw new ConflictException(
          'Property is not available for the requested dates',
        );
      }

      const breakdown = this.pricingService.calculatePrice(
        property,
        checkIn,
        checkOut,
        dto.guests,
      );

      const booking = await tx.booking.create({
        data: {
          checkIn,
          checkOut,
          guests: dto.guests,
          totalPrice: breakdown.total.toString(),
          specialRequests: dto.specialRequests,
          guestId,
          propertyId: dto.propertyId,
          status: BookingStatus.PENDING,
        },
        include: {
          property: { select: { title: true, address: true, city: true } },
          guest: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });

      this.logger.log(`Booking ${booking.id} created for property ${dto.propertyId}`);

      return {
        ...booking,
        priceBreakdown: {
          nights: breakdown.nights,
          nightlyTotal: breakdown.nightlyTotal.toFixed(2),
          cleaningFee: breakdown.cleaningFee.toFixed(2),
          total: breakdown.total.toFixed(2),
        },
      };
    });
  }

  async findOne(id: string, userId: string, userRole: Role) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        property: {
          select: { title: true, address: true, city: true, province: true, ownerId: true },
        },
        guest: { select: { id: true, email: true, firstName: true, lastName: true } },
        paymentEvents: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking "${id}" not found`);
    }

    const isGuest = booking.guestId === userId;
    const isOwner = booking.property.ownerId === userId;
    const isAdmin = userRole === Role.ADMIN;

    if (!isGuest && !isOwner && !isAdmin) {
      throw new ForbiddenException('Access denied');
    }

    return booking;
  }

  async cancel(id: string, userId: string, userRole: Role) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { property: { select: { ownerId: true } } },
    });

    if (!booking) {
      throw new NotFoundException(`Booking "${id}" not found`);
    }

    const isGuest = booking.guestId === userId;
    const isOwner = booking.property.ownerId === userId;
    const isAdmin = userRole === Role.ADMIN;

    if (!isGuest && !isOwner && !isAdmin) {
      throw new ForbiddenException('Access denied');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed booking');
    }

    return this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
    });
  }

  async listGuestBookings(guestId: string) {
    return this.prisma.booking.findMany({
      where: { guestId },
      include: {
        property: {
          select: {
            title: true,
            city: true,
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listOwnerBookings(ownerId: string) {
    return this.prisma.booking.findMany({
      where: { property: { ownerId } },
      include: {
        property: { select: { title: true, city: true } },
        guest: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuote(dto: CreateBookingDto) {
    const checkIn = new Date(dto.checkIn);
    const checkOut = new Date(dto.checkOut);

    if (checkIn >= checkOut) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId, isActive: true },
      include: { seasonalPricings: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    return this.pricingService.getQuote(property, checkIn, checkOut, dto.guests);
  }
}
