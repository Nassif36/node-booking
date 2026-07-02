import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { BookingStatus, Role } from '@prisma/client';
import { BookingsService } from '../../modules/bookings/bookings.service';
import { PricingService } from '../../modules/bookings/services/pricing.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  booking: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  property: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};

const mockPricing = {
  calculatePrice: jest.fn().mockReturnValue({
    nights: 7,
    nightlyTotal: new Decimal('70000'),
    cleaningFee: new Decimal('2000'),
    total: new Decimal('72000'),
    perNightDetail: [],
  }),
  getQuote: jest.fn(),
};

const mockProperty = {
  id: 'property-1',
  title: 'Test Villa',
  address: 'Test St 1',
  city: 'Buenos Aires',
  basePrice: new Decimal('10000'),
  cleaningFee: new Decimal('2000'),
  maxGuests: 4,
  isActive: true,
  ownerId: 'owner-1',
  seasonalPricings: [],
};

const mockBooking = {
  id: 'booking-1',
  checkIn: new Date('2030-08-01'),
  checkOut: new Date('2030-08-08'),
  guests: 2,
  totalPrice: new Decimal('72000'),
  status: BookingStatus.PENDING,
  guestId: 'guest-1',
  propertyId: 'property-1',
  property: {
    title: 'Test Villa',
    address: 'Test St 1',
    city: 'Buenos Aires',
    province: 'Buenos Aires',
    ownerId: 'owner-1',
  },
  guest: { id: 'guest-1', email: 'g@test.com', firstName: 'Guest', lastName: 'User' },
  paymentEvents: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('BookingsService', () => {
  let service: BookingsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PricingService, useValue: mockPricing },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    // Use dates 30+ days in the future so the "must be future" guard passes
    const dto = {
      propertyId: 'property-1',
      checkIn: '2030-08-01',
      checkOut: '2030-08-08',
      guests: 2,
    };

    const buildTx = (overrides: Record<string, any> = {}) => ({
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      property: {
        findUnique: jest.fn().mockResolvedValue(overrides.property ?? mockProperty),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue(overrides.overlap ?? null),
        create: jest.fn().mockResolvedValue(mockBooking),
      },
    });

    it('creates a booking and returns price breakdown', async () => {
      mockPrisma.$transaction.mockImplementation((fn) => fn(buildTx()));

      const result = await service.create('guest-1', dto);

      expect(result.id).toBe('booking-1');
      expect(result.priceBreakdown).toBeDefined();
      expect(result.priceBreakdown.total).toBe('72000.00');
    });

    it('throws NotFoundException when property does not exist', async () => {
      mockPrisma.$transaction.mockImplementation((fn) =>
        fn(buildTx({ property: null })),
      );
      await expect(service.create('guest-1', dto)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when dates overlap an existing booking', async () => {
      mockPrisma.$transaction.mockImplementation((fn) =>
        fn(buildTx({ overlap: { id: 'existing-booking' } })),
      );
      await expect(service.create('guest-1', dto)).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when owner tries to book own property', async () => {
      mockPrisma.$transaction.mockImplementation((fn) => fn(buildTx()));
      await expect(service.create('owner-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for past check-in date', async () => {
      const pastDto = { ...dto, checkIn: '2020-01-01', checkOut: '2020-01-05' };
      await expect(service.create('guest-1', pastDto)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns booking for the guest who made it', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      const result = await service.findOne('booking-1', 'guest-1', Role.GUEST);
      expect(result.id).toBe('booking-1');
    });

    it('throws NotFoundException for unknown booking', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nope', 'guest-1', Role.GUEST)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for an unrelated user', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      await expect(
        service.findOne('booking-1', 'random-user', Role.GUEST),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMIN to access any booking', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      const result = await service.findOne('booking-1', 'any-admin', Role.ADMIN);
      expect(result).toBeDefined();
    });

    it('allows the property owner to view a booking on their property', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      const result = await service.findOne('booking-1', 'owner-1', Role.OWNER);
      expect(result).toBeDefined();
    });
  });

  // ─── cancel ──────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('cancels booking when called by the guest', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrisma.booking.update.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED,
      });

      const result = await service.cancel('booking-1', 'guest-1', Role.GUEST);
      expect(result.status).toBe(BookingStatus.CANCELLED);
    });

    it('throws ForbiddenException for unrelated user', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      await expect(
        service.cancel('booking-1', 'random-user', Role.GUEST),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when booking is already cancelled', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED,
      });
      await expect(service.cancel('booking-1', 'guest-1', Role.GUEST)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when booking is already completed', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.COMPLETED,
      });
      await expect(service.cancel('booking-1', 'guest-1', Role.GUEST)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
