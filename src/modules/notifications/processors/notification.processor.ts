import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import {
  BookingNotificationData,
  NOTIFICATION_JOBS,
} from '../interfaces/notification.interface';

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    super();
    this.transporter = nodemailer.createTransport({
      host: configService.get<string>('email.host'),
      port: configService.get<number>('email.port'),
      secure: configService.get<number>('email.port') === 465,
      auth: {
        user: configService.get<string>('email.user'),
        pass: configService.get<string>('email.password'),
      },
    });
  }

  async process(job: Job<BookingNotificationData>): Promise<void> {
    this.logger.log(`Processing notification job "${job.name}" (${job.id})`);

    try {
      switch (job.name) {
        case NOTIFICATION_JOBS.BOOKING_CONFIRMATION:
          await this.sendConfirmationEmail(job.data);
          break;

        case NOTIFICATION_JOBS.BOOKING_CANCELLATION:
          await this.sendCancellationEmail(job.data);
          break;

        default:
          this.logger.warn(`Unknown notification job type: "${job.name}"`);
      }
    } catch (error) {
      this.logger.error(
        `Notification job ${job.id} failed: ${error.message}`,
        error.stack,
      );
      throw error; // triggers BullMQ retry
    }
  }

  // ─── Email builders ───────────────────────────────────────────────────────

  private async sendConfirmationEmail(data: BookingNotificationData): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="utf-8"><title>Reserva Confirmada</title></head>
      <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333">
        <h1 style="color:#1a7f37">¡Reserva Confirmada! ✅</h1>
        <p>Hola <strong>${data.guestName}</strong>,</p>
        <p>Tu reserva fue confirmada exitosamente. ¡Nos vemos pronto!</p>
        <div style="background:#f6f8fa;border-radius:8px;padding:20px;margin:20px 0">
          <h2 style="margin-top:0;color:#1a1a1a">${data.propertyTitle}</h2>
          <p>📍 ${data.propertyAddress}</p>
          <p>📅 <strong>Check-in:</strong> ${data.checkIn}</p>
          <p>📅 <strong>Check-out:</strong> ${data.checkOut}</p>
          <p>👥 <strong>Huéspedes:</strong> ${data.guests}</p>
          <p>💰 <strong>Total pagado:</strong> ARS ${data.totalPrice}</p>
          <p style="color:#666;font-size:13px">🔖 Código de reserva: <code>${data.bookingId}</code></p>
        </div>
        <p>¡Gracias por elegir Booking AR! 🇦🇷</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#888">Este es un mensaje automático, por favor no respondas a este correo.</p>
      </body>
      </html>`;

    await this.sendMail(data.guestEmail, `✅ Reserva confirmada – ${data.propertyTitle}`, html);
    this.logger.log(`Confirmation email sent to ${data.guestEmail} (booking ${data.bookingId})`);
  }

  private async sendCancellationEmail(data: BookingNotificationData): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="utf-8"><title>Reserva Cancelada</title></head>
      <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333">
        <h1 style="color:#cf222e">Reserva Cancelada ❌</h1>
        <p>Hola <strong>${data.guestName}</strong>,</p>
        <p>Te informamos que tu reserva ha sido cancelada.</p>
        <div style="background:#f6f8fa;border-radius:8px;padding:20px;margin:20px 0">
          <h2 style="margin-top:0;color:#1a1a1a">${data.propertyTitle}</h2>
          <p>📅 <strong>Check-in:</strong> ${data.checkIn}</p>
          <p>📅 <strong>Check-out:</strong> ${data.checkOut}</p>
          <p style="color:#666;font-size:13px">🔖 Código de reserva: <code>${data.bookingId}</code></p>
        </div>
        <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
        <p>Booking AR 🇦🇷</p>
      </body>
      </html>`;

    await this.sendMail(data.guestEmail, `❌ Reserva cancelada – ${data.propertyTitle}`, html);
    this.logger.log(`Cancellation email sent to ${data.guestEmail} (booking ${data.bookingId})`);
  }

  private async sendMail(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({
      from: `"Booking AR" <${this.configService.get<string>('email.from')}>`,
      to,
      subject,
      html,
      text: html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    });
  }
}
