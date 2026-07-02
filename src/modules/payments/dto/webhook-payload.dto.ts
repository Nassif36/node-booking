import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

class WebhookDataDto {
  @ApiProperty({ description: 'Mercado Pago resource ID' })
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class WebhookPayloadDto {
  @ApiProperty({ description: 'Notification ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Resource type, e.g. "payment"' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Event action, e.g. "payment.created"' })
  @IsString()
  action: string;

  @ApiProperty({ type: WebhookDataDto })
  data: WebhookDataDto;
}
