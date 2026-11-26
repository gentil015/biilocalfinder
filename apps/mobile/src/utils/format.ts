import { DEFAULT_CURRENCY } from '@/src/constants/config';
import type {
  BookingStatus,
  QuoteStatus,
  ServiceRequestStatus,
  VerificationStatus,
} from '@/src/types/api';

export function formatMoney(amount?: number | string | null, currency = DEFAULT_CURRENCY): string {
  if (amount === null || amount === undefined || amount === '') return 'Price on request';
  const value = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(value)) return 'Price on request';
  return `${currency} ${Math.round(value).toLocaleString('en-RW')}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-RW', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(value?: string | null): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('en-RW', { hour: '2-digit', minute: '2-digit' });
  }
  return value;
}

export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const requestLabels: Record<ServiceRequestStatus, string> = {
  OPEN: 'Open',
  QUOTED: 'Quotes received',
  NEGOTIATING: 'Negotiating',
  ACCEPTED: 'Accepted',
  BOOKED: 'Booked',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

const quoteLabels: Record<QuoteStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

const bookingLabels: Record<BookingStatus, string> = {
  REQUESTED: 'Requested',
  QUOTED: 'Quoted',
  NEGOTIATING: 'Negotiating',
  ACCEPTED: 'Accepted',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const verificationLabels: Record<VerificationStatus, string> = {
  UNVERIFIED: 'Not verified',
  PENDING: 'Pending review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
  EXPIRED: 'Expired',
};

export const statusLabel = {
  request: (status: string) => requestLabels[status as ServiceRequestStatus] ?? humanize(status),
  quote: (status: string) => quoteLabels[status as QuoteStatus] ?? humanize(status),
  booking: (status: string) => bookingLabels[status as BookingStatus] ?? humanize(status),
  verification: (status: string) => verificationLabels[status as VerificationStatus] ?? humanize(status),
};

export function truncate(value: string, max = 100): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
