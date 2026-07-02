import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUrl,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddImageDto {
  @ApiProperty({ example: 'https://example.com/images/living-room.jpg' })
  @IsString()
  @IsUrl({ require_tld: false })
  url: string;

  @ApiPropertyOptional({ example: 'Vista del living con luz natural' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;

  @ApiPropertyOptional({ default: false, description: 'Set as the primary listing image' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: 0, description: 'Display order (lower = first)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  order?: number;
}
