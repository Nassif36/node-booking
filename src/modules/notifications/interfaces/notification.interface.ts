export interface NotificationPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface BookingNotificationData {
  bookingId: string;
  guestEmail: string;
  guestName: string;
  propertyTitle: string;
  propertyAddress: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalPrice: string;
  status: string;
}

export const NOTIFICATION_JOBS = {
  BOOKING_CONFIRMATION: 'booking-confirmation',
  BOOKING_CANCELLATION: 'booking-cancellation',
} as const;

export type NotificationJobName =
  (typeof NOTIFICATION_JOBS)[keyof typeof NOTIFICATION_JOBS];
