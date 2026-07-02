import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import Decimal from 'decimal.js';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly mpClient: MercadoPagoConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.mpClient = new MercadoPagoConfig({
      accessToken: this.configService.get<string>('mercadopago.accessToken'),
      options: { timeout: 10_000 },
    });
  }

  // ─── Create Checkout ─────────────────────────────────────────────────────────

  async createCheckout(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, guestId: userId },
      include: {
        property: { select: { title: true } },
        guest: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Booking is in "${booking.status}" status. Only PENDING bookings can be paid.`,
      );
    }

    const checkInStr = booking.checkIn.toLocaleDateString('es-AR');
    const checkOutStr = booking.checkOut.toLocaleDateString('es-AR');
    const totalAmount = Number(new Decimal(booking.totalPrice.toString()).toFixed(2));

    const preferenceClient = new Preference(this.mpClient);

    const response = await preferenceClient.create({
      body: {
        items: [
          {
            id: booking.id,
            title: `Reserva: ${booking.property.title}`,
            description: `Check-in: ${checkInStr} | Check-out: ${checkOutStr} | ${booking.guests} huésped(es)`,
            quantity: 1,
            unit_price: totalAmount,
            currency_id: 'ARS',
          },
        ],
        payer: {
          email: booking.guest.email,
          name: booking.guest.firstName,
          surname: booking.guest.lastName,
        },
        back_urls: {
          success: this.configService.get<string>('mercadopago.successUrl'),
          failure: this.configService.get<string>('mercadopago.failureUrl'),
          pending: this.configService.get<string>('mercadopago.pendingUrl'),
        },
        auto_return: 'approved',
        notification_url: this.configService.get<string>('mercadopago.notificationUrl'),
        external_reference: booking.id,
        statement_descriptor: 'BOOKING AR',
      },
    });

    this.logger.log(`Checkout created for booking ${bookingId} → preference ${response.id}`);

    return {
      preferenceId: response.id,
      checkoutUrl: response.init_point,
      sandboxUrl: response.sandbox_init_point,
      bookingId,
      totalAmount: booking.totalPrice.toString(),
      currency: 'ARS',
    };
  }

  // ─── Webhook ─────────────────────────────────────────────────────────────────

  async handleWebhook(body: any, xSignature: string, xRequestId: string): Promise<void> {
    const secret = this.configService.get<string>('mercadopago.webhookSecret');

    if (secret) {
      this.verifySignature(body, xSignature, xRequestId, secret);
    }

    if (body?.type === 'payment' && body?.data?.id) {
      await this.processPaymentNotification(String(body.data.id));
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private verifySignature(
    body: any,
    xSignature: string,
    xRequestId: string,
    secret: string,
  ): void {
    if (!xSignature) {
      throw new UnauthorizedException('Missing x-signature header');
    }

    let ts: string | undefined;
    let v1: string | undefined;

    for (const part of xSignature.split(',')) {
      const [key, value] = part.split('=');
      if (key === 'ts') ts = value;
      if (key === 'v1') v1 = value;
    }

    if (!ts || !v1) {
      throw new UnauthorizedException('Malformed x-signature header');
    }

    const dataId = body?.data?.id ?? '';
    const manifest = `id:${dataId};request-id:${xRequestId ?? ''};ts:${ts}`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');

    if (v1 !== expected) {
      throw new UnauthorizedException('Webhook signature verification failed');
    }
  }

  private async processPaymentNotification(externalId: string): Promise<void> {
    // Idempotency guard – skip already-processed events
    const existing = await this.prisma.paymentEvent.findUnique({ where: { externalId } });
    if (existing?.processedAt) {
      this.logger.log(`Payment ${externalId} already processed, skipping`);
      return;
    }

    // Fetch full payment details from Mercado Pago
    const mpPayment = new Payment(this.mpClient);
    let paymentData: any;
    try {
      paymentData = await mpPayment.get({ id: externalId });
    } catch (err) {
      this.logger.error(`Failed to fetch payment ${externalId} from MP: ${err.message}`);
      throw err;
    }

    const bookingId: string = paymentData.external_reference;
    if (!bookingId) {
      this.logger.warn(`Payment ${externalId} has no external_reference – ignoring`);
      return;
    }

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      this.logger.warn(`Booking ${bookingId} not found for payment ${externalId}`);
      return;
    }

    const status = this.mapMpStatus(paymentData.status ?? 'pending');
    const amount = new Decimal(paymentData.transaction_amount ?? 0);

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentEvent.upsert({
        where: { externalId },
        create: {
          externalId,
          bookingId,
          status,
          amount: amount.toFixed(2),
          currency: paymentData.currency_id ?? 'ARS',
          rawPayload: paymentData,
          processedAt: new Date(),
        },
        update: {
          status,
          rawPayload: paymentData,
          processedAt: new Date(),
        },
      });

      if (status === PaymentStatus.APPROVED) {
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.CONFIRMED },
        });
        this.logger.log(`Booking ${bookingId} confirmed via payment ${externalId}`);
      } else if (status === PaymentStatus.REJECTED || status === PaymentStatus.CANCELLED) {
        if (booking.status === BookingStatus.PENDING) {
          await tx.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.CANCELLED },
          });
          this.logger.log(`Booking ${bookingId} cancelled due to ${status} payment`);
        }
      }
    });

    // Queue notification outside the DB transaction
    if (status === PaymentStatus.APPROVED) {
      await this.notificationsService.queueBookingConfirmation(bookingId);
    }
  }

  private mapMpStatus(mpStatus: string): PaymentStatus {
    const map: Record<string, PaymentStatus> = {
      pending: PaymentStatus.PENDING,
      authorized: PaymentStatus.APPROVED,
      approved: PaymentStatus.APPROVED,
      in_process: PaymentStatus.PENDING,
      in_mediation: PaymentStatus.PENDING,
      rejected: PaymentStatus.REJECTED,
      cancelled: PaymentStatus.CANCELLED,
      refunded: PaymentStatus.REFUNDED,
      charged_back: PaymentStatus.REFUNDED,
    };
    return map[mpStatus] ?? PaymentStatus.PENDING;
  }
}
