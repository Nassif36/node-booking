import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { SearchPropertiesDto } from './dto/search-properties.dto';
import { CreateSeasonalPricingDto } from './dto/create-seasonal-pricing.dto';
import { AddImageDto } from './dto/add-image.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('properties')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  // ─── Public ──────────────────────────────────────────────────────────────────

  @Get()
  @Public()
  @ApiOperation({ summary: 'Search available properties with optional filters' })
  @ApiResponse({ status: 200, description: 'Paginated property list' })
  findAll(@Query() query: SearchPropertiesDto) {
    return this.propertiesService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get full property details' })
  @ApiParam({ name: 'id', description: 'Property UUID' })
  @ApiResponse({ status: 200, description: 'Property details' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  findOne(@Param('id') id: string) {
    return this.propertiesService.findOne(id);
  }

  // ─── Owner / Admin ────────────────────────────────────────────────────────────

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new property listing (owner only)' })
  @ApiResponse({ status: 201, description: 'Property created' })
  create(@CurrentUser('id') ownerId: string, @Body() dto: CreatePropertyDto) {
    return this.propertiesService.create(ownerId, dto);
  }

  @Get('owner/my-properties')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List properties owned by the authenticated user' })
  findMyProperties(@CurrentUser('id') ownerId: string) {
    return this.propertiesService.findByOwner(ownerId);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a property (owner only)' })
  @ApiParam({ name: 'id', description: 'Property UUID' })
  update(
    @Param('id') id: string,
    @CurrentUser('id') ownerId: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(id, ownerId, dto);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a property listing (owner only)' })
  @ApiParam({ name: 'id', description: 'Property UUID' })
  remove(@Param('id') id: string, @CurrentUser('id') ownerId: string) {
    return this.propertiesService.remove(id, ownerId);
  }

  // ─── Images ──────────────────────────────────────────────────────────────────

  @Post(':id/images')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Add an image to a property' })
  @ApiParam({ name: 'id', description: 'Property UUID' })
  addImage(
    @Param('id') propertyId: string,
    @CurrentUser('id') ownerId: string,
    @Body() dto: AddImageDto,
  ) {
    return this.propertiesService.addImage(propertyId, ownerId, dto);
  }

  @Delete(':id/images/:imageId')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an image from a property' })
  @ApiParam({ name: 'id', description: 'Property UUID' })
  @ApiParam({ name: 'imageId', description: 'Image UUID' })
  removeImage(
    @Param('id') propertyId: string,
    @Param('imageId') imageId: string,
    @CurrentUser('id') ownerId: string,
  ) {
    return this.propertiesService.removeImage(imageId, propertyId, ownerId);
  }

  // ─── Seasonal Pricing ────────────────────────────────────────────────────────

  @Post(':id/seasonal-pricing')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Add a seasonal pricing period to a property' })
  @ApiParam({ name: 'id', description: 'Property UUID' })
  createSeasonalPricing(
    @Param('id') propertyId: string,
    @CurrentUser('id') ownerId: string,
    @Body() dto: CreateSeasonalPricingDto,
  ) {
    return this.propertiesService.createSeasonalPricing(propertyId, ownerId, dto);
  }

  @Delete(':id/seasonal-pricing/:pricingId')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a seasonal pricing period' })
  @ApiParam({ name: 'id', description: 'Property UUID' })
  @ApiParam({ name: 'pricingId', description: 'Seasonal pricing UUID' })
  deleteSeasonalPricing(
    @Param('id') propertyId: string,
    @Param('pricingId') pricingId: string,
    @CurrentUser('id') ownerId: string,
  ) {
    return this.propertiesService.deleteSeasonalPricing(pricingId, propertyId, ownerId);
  }
}
