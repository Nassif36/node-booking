import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { SearchPropertiesDto } from './dto/search-properties.dto';
import { CreateSeasonalPricingDto } from './dto/create-seasonal-pricing.dto';
import { AddImageDto } from './dto/add-image.dto';

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreatePropertyDto) {
    return this.prisma.property.create({
      data: {
        ...dto,
        country: dto.country || 'Argentina',
        cleaningFee: dto.cleaningFee ?? 0,
        amenities: dto.amenities ?? [],
        ownerId,
      },
      include: {
        images: true,
        seasonalPricings: true,
      },
    });
  }

  async findAll(query: SearchPropertiesDto) {
    const { city, province, checkIn, checkOut, guests, minPrice, maxPrice, page = 1, limit = 10 } =
      query;

    const where: Prisma.PropertyWhereInput = { isActive: true };

    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (province) where.province = { contains: province, mode: 'insensitive' };
    if (guests) where.maxGuests = { gte: guests };

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.basePrice = {};
      if (minPrice !== undefined) (where.basePrice as any).gte = minPrice;
      if (maxPrice !== undefined) (where.basePrice as any).lte = maxPrice;
    }

    if (checkIn && checkOut) {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      if (checkInDate >= checkOutDate) {
        throw new BadRequestException('checkOut must be after checkIn');
      }
      where.bookings = {
        none: {
          status: { notIn: ['CANCELLED'] },
          checkIn: { lt: checkOutDate },
          checkOut: { gt: checkInDate },
        },
      };
    }

    const skip = (page - 1) * limit;

    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          owner: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { bookings: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      data: properties,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        images: { orderBy: { order: 'asc' } },
        seasonalPricings: { orderBy: { startDate: 'asc' } },
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!property) {
      throw new NotFoundException(`Property "${id}" not found`);
    }
    return property;
  }

  async findByOwner(ownerId: string) {
    return this.prisma.property.findMany({
      where: { ownerId },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, ownerId: string, dto: UpdatePropertyDto) {
    await this.assertOwnership(id, ownerId);
    return this.prisma.property.update({
      where: { id },
      data: dto,
      include: { images: true, seasonalPricings: true },
    });
  }

  async remove(id: string, ownerId: string) {
    await this.assertOwnership(id, ownerId);
    return this.prisma.property.update({ where: { id }, data: { isActive: false } });
  }

  async addImage(propertyId: string, ownerId: string, dto: AddImageDto) {
    await this.assertOwnership(propertyId, ownerId);

    if (dto.isPrimary) {
      await this.prisma.propertyImage.updateMany({
        where: { propertyId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return this.prisma.propertyImage.create({ data: { ...dto, propertyId } });
  }

  async removeImage(imageId: string, propertyId: string, ownerId: string) {
    await this.assertOwnership(propertyId, ownerId);

    const image = await this.prisma.propertyImage.findFirst({
      where: { id: imageId, propertyId },
    });

    if (!image) {
      throw new NotFoundException(`Image "${imageId}" not found`);
    }

    return this.prisma.propertyImage.delete({ where: { id: imageId } });
  }

  async createSeasonalPricing(
    propertyId: string,
    ownerId: string,
    dto: CreateSeasonalPricingDto,
  ) {
    await this.assertOwnership(propertyId, ownerId);

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException('endDate must be after startDate');
    }

    return this.prisma.seasonalPricing.create({
      data: {
        startDate,
        endDate,
        pricePerNight: dto.pricePerNight,
        description: dto.description,
        propertyId,
      },
    });
  }

  async deleteSeasonalPricing(pricingId: string, propertyId: string, ownerId: string) {
    await this.assertOwnership(propertyId, ownerId);

    const pricing = await this.prisma.seasonalPricing.findFirst({
      where: { id: pricingId, propertyId },
    });

    if (!pricing) {
      throw new NotFoundException(`Seasonal pricing "${pricingId}" not found`);
    }

    return this.prisma.seasonalPricing.delete({ where: { id: pricingId } });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async assertOwnership(propertyId: string, ownerId: string): Promise<void> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true },
    });

    if (!property) {
      throw new NotFoundException(`Property "${propertyId}" not found`);
    }

    if (property.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this property');
    }
  }
}
