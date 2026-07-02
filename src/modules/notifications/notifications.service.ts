import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BookingNotificationData,
  NOTIFICATION_JOBS,
} from './interfaces/notification.interface';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async queueBookingConfirmation(bookingId: string): Promise<void> {
    const data = await this.buildNotificationData(bookingId);
    await this.notificationsQueue.add(NOTIFICATION_JOBS.BOOKING_CONFIRMATION, data, {
      jobId: `confirmation-${bookingId}`,
      removeOnComplete: true,
      removeOnFail: false,
    });
    this.logger.log(`Queued booking-confirmation for booking ${bookingId}`);
  }

  async queueBookingCancellation(bookingId: string): Promise<void> {
    const data = await this.buildNotificationData(bookingId);
    await this.notificationsQueue.add(NOTIFICATION_JOBS.BOOKING_CANCELLATION, data, {
      jobId: `cancellation-${bookingId}`,
      removeOnComplete: true,
      removeOnFail: false,
    });
    this.logger.log(`Queued booking-cancellation for booking ${bookingId}`);
  }

  private async buildNotificationData(bookingId: string): Promise<BookingNotificationData> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        guest: { select: { email: true, firstName: true, lastName: true } },
        property: { select: { title: true, address: true, city: true } },
      },
    });

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found — cannot build notification payload`);
    }

    return {
      bookingId: booking.id,
      guestEmail: booking.guest.email,
      guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
      propertyTitle: booking.property.title,
      propertyAddress: `${booking.property.address}, ${booking.property.city}`,
      checkIn: booking.checkIn.toLocaleDateString('es-AR'),
      checkOut: booking.checkOut.toLocaleDateString('es-AR'),
      guests: booking.guests,
      totalPrice: booking.totalPrice.toString(),
      status: booking.status,
    };
  }
}
