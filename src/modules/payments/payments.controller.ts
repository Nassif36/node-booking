import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('payments')
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout/:bookingId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a Mercado Pago checkout preference for a pending booking' })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID' })
  @ApiResponse({ status: 201, description: 'Checkout preference created' })
  @ApiResponse({ status: 400, description: 'Booking is not in PENDING status' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  createCheckout(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.createCheckout(bookingId, userId);
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mercado Pago IPN webhook endpoint',
    description:
      'Receives payment notifications from Mercado Pago. Signature is verified with HMAC-SHA256.',
  })
  @ApiHeader({ name: 'x-signature', description: 'MP HMAC signature (ts=...,v1=...)' })
  @ApiHeader({ name: 'x-request-id', description: 'MP request UUID' })
  @ApiResponse({ status: 200, description: 'Notification received and queued for processing' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  handleWebhook(
    @Body() body: WebhookPayloadDto,
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
  ) {
    return this.paymentsService.handleWebhook(body, xSignature, xRequestId);
  }
}
