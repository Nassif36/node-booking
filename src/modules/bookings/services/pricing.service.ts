import { Injectable, BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { Property, SeasonalPricing } from '@prisma/client';

export interface PriceBreakdown {
  nights: number;
  nightlyRate: Decimal;
  nightlyTotal: Decimal;
  cleaningFee: Decimal;
  total: Decimal;
  perNightDetail: Array<{ date: string; rate: string }>;
}

export interface PriceQuote {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  nightlyRate: string;
  nightlyTotal: string;
  cleaningFee: string;
  total: string;
  currency: string;
  perNightDetail: Array<{ date: string; rate: string }>;
}

type PropertyWithPricing = Property & { seasonalPricings: SeasonalPricing[] };

@Injectable()
export class PricingService {
  /**
   * Full price breakdown for a stay.
   * Uses Decimal.js for exact arithmetic (no floating-point rounding errors).
   */
  calculatePrice(
    property: PropertyWithPricing,
    checkIn: Date,
    checkOut: Date,
    guests: number,
  ): PriceBreakdown {
    if (checkIn >= checkOut) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    if (guests > property.maxGuests) {
      throw new BadRequestException(
        `This property allows a maximum of ${property.maxGuests} guests`,
      );
    }

    const nights = this.calculateNights(checkIn, checkOut);
    if (nights < 1) {
      throw new BadRequestException('Minimum stay is 1 night');
    }

    const perNightDetail: Array<{ date: string; rate: string }> = [];
    let nightlyTotal = new Decimal(0);

    for (let i = 0; i < nights; i++) {
      const stayDate = this.addDays(checkIn, i);
      const rate = this.getNightlyRate(property, stayDate);
      perNightDetail.push({ date: stayDate.toISOString().split('T')[0], rate: rate.toFixed(2) });
      nightlyTotal = nightlyTotal.add(rate);
    }

    const cleaningFee = new Decimal(property.cleaningFee.toString());
    const total = nightlyTotal.add(cleaningFee);
    const nightlyRate = nightlyTotal.div(nights).toDecimalPlaces(2);

    return {
      nights,
      nightlyRate,
      nightlyTotal: nightlyTotal.toDecimalPlaces(2),
      cleaningFee: cleaningFee.toDecimalPlaces(2),
      total: total.toDecimalPlaces(2),
      perNightDetail,
    };
  }

  /**
   * Returns the rate for a given date, using seasonal pricing if applicable.
   */
  getNightlyRate(property: PropertyWithPricing, date: Date): Decimal {
    const basePrice = new Decimal(property.basePrice.toString());

    const seasonal = property.seasonalPricings.find((sp) => {
      const start = new Date(sp.startDate);
      const end = new Date(sp.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });

    return seasonal ? new Decimal(seasonal.pricePerNight.toString()) : basePrice;
  }

  calculateNights(checkIn: Date, checkOut: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((checkOut.getTime() - checkIn.getTime()) / msPerDay);
  }

  /** Convenience method that returns a serialisable quote object. */
  getQuote(
    property: PropertyWithPricing,
    checkIn: Date,
    checkOut: Date,
    guests: number,
  ): PriceQuote {
    const breakdown = this.calculatePrice(property, checkIn, checkOut, guests);
    return {
      propertyId: property.id,
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
      guests,
      nights: breakdown.nights,
      nightlyRate: breakdown.nightlyRate.toFixed(2),
      nightlyTotal: breakdown.nightlyTotal.toFixed(2),
      cleaningFee: breakdown.cleaningFee.toFixed(2),
      total: breakdown.total.toFixed(2),
      currency: 'ARS',
      perNightDetail: breakdown.perNightDetail,
    };
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
