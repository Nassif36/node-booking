import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PricingService } from './pricing.service';

// Helper to create a future date
const futureDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
};

const mockProperty = {
  id: 'property-uuid-1',
  basePrice: new Decimal('10000'),
  cleaningFee: new Decimal('2000'),
  maxGuests: 4,
  seasonalPricings: [],
} as any;

const mockPropertyWithSeasonal = {
  ...mockProperty,
  seasonalPricings: [
    {
      id: 'sp-uuid-1',
      startDate: new Date('2030-12-20'),
      endDate: new Date('2031-01-05'),
      pricePerNight: new Decimal('18000'),
    },
  ],
} as any;

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PricingService],
    }).compile();

    service = module.get<PricingService>(PricingService);
  });

  // ─── calculateNights ──────────────────────────────────────────────────────

  describe('calculateNights', () => {
    it('returns 7 for a week-long stay', () => {
      expect(
        service.calculateNights(new Date('2030-07-01'), new Date('2030-07-08')),
      ).toBe(7);
    });

    it('returns 1 for a one-night stay', () => {
      expect(
        service.calculateNights(new Date('2030-07-01'), new Date('2030-07-02')),
      ).toBe(1);
    });
  });

  // ─── getNightlyRate ───────────────────────────────────────────────────────

  describe('getNightlyRate', () => {
    it('returns base price when no seasonal pricing matches', () => {
      const rate = service.getNightlyRate(mockProperty, new Date('2030-07-15'));
      expect(rate.toNumber()).toBe(10000);
    });

    it('returns seasonal price when date falls within a seasonal period', () => {
      const rate = service.getNightlyRate(
        mockPropertyWithSeasonal,
        new Date('2030-12-25'),
      );
      expect(rate.toNumber()).toBe(18000);
    });

    it('returns base price for a date outside any seasonal period', () => {
      const rate = service.getNightlyRate(
        mockPropertyWithSeasonal,
        new Date('2030-07-01'),
      );
      expect(rate.toNumber()).toBe(10000);
    });
  });

  // ─── calculatePrice ───────────────────────────────────────────────────────

  describe('calculatePrice', () => {
    it('calculates correctly with base rate only', () => {
      const checkIn = new Date('2030-07-01');
      const checkOut = new Date('2030-07-08');

      const result = service.calculatePrice(mockProperty, checkIn, checkOut, 2);

      expect(result.nights).toBe(7);
      expect(result.nightlyTotal.toNumber()).toBe(70000);
      expect(result.cleaningFee.toNumber()).toBe(2000);
      expect(result.total.toNumber()).toBe(72000);
    });

    it('applies seasonal rate for all nights within the season', () => {
      const checkIn = new Date('2030-12-25');
      const checkOut = new Date('2030-12-30');

      const result = service.calculatePrice(mockPropertyWithSeasonal, checkIn, checkOut, 2);

      expect(result.nights).toBe(5);
      expect(result.nightlyTotal.toNumber()).toBe(90000); // 5 × 18000
      expect(result.total.toNumber()).toBe(92000);
    });

    it('splits base and seasonal rate for a cross-period stay', () => {
      // Dec 18–22: nights on Dec 18, 19 → base (10000); Dec 20, 21 → seasonal (18000)
      const checkIn = new Date('2030-12-18');
      const checkOut = new Date('2030-12-22');

      const result = service.calculatePrice(mockPropertyWithSeasonal, checkIn, checkOut, 2);

      expect(result.nights).toBe(4);
      const expected = 2 * 10000 + 2 * 18000;
      expect(result.nightlyTotal.toNumber()).toBe(expected);
    });

    it('throws when guests exceed maxGuests', () => {
      expect(() =>
        service.calculatePrice(mockProperty, new Date('2030-07-01'), new Date('2030-07-03'), 10),
      ).toThrow(BadRequestException);
    });

    it('throws when checkIn is after checkOut', () => {
      expect(() =>
        service.calculatePrice(mockProperty, new Date('2030-07-10'), new Date('2030-07-05'), 2),
      ).toThrow(BadRequestException);
    });

    it('throws for same-day check-in and check-out', () => {
      const d = new Date('2030-07-01');
      expect(() => service.calculatePrice(mockProperty, d, d, 2)).toThrow(BadRequestException);
    });

    it('includes perNightDetail with one entry per night', () => {
      const checkIn = new Date('2030-07-01');
      const checkOut = new Date('2030-07-04');
      const result = service.calculatePrice(mockProperty, checkIn, checkOut, 2);
      expect(result.perNightDetail).toHaveLength(3);
      expect(result.perNightDetail[0]).toMatchObject({ date: '2030-07-01', rate: '10000.00' });
    });
  });

  // ─── getQuote ─────────────────────────────────────────────────────────────

  describe('getQuote', () => {
    it('returns a complete serialisable quote', () => {
      const checkIn = new Date('2030-07-01');
      const checkOut = new Date('2030-07-03');

      const quote = service.getQuote(mockProperty, checkIn, checkOut, 2);

      expect(quote).toMatchObject({
        propertyId: 'property-uuid-1',
        nights: 2,
        nightlyTotal: '20000.00',
        cleaningFee: '2000.00',
        total: '22000.00',
        currency: 'ARS',
      });
      expect(quote.perNightDetail).toHaveLength(2);
    });
  });
});
