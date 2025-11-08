/**
 * Tests for Invitation UI Utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateTimeUntilExpiry, getStatusBadgeVariant } from '../invitation-utils';

describe('calculateTimeUntilExpiry', () => {
  beforeEach(() => {
    // Mock Date.now() to a fixed timestamp
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "Expired" for past dates', () => {
    const pastDate = '2024-12-31T12:00:00Z'; // 1 day ago
    expect(calculateTimeUntilExpiry(pastDate)).toBe('Expired');
  });

  it('should return "Expired" for current time', () => {
    const now = '2025-01-01T12:00:00Z';
    expect(calculateTimeUntilExpiry(now)).toBe('Expired');
  });

  it('should return days for expiry more than 24 hours away', () => {
    const twoDaysLater = '2025-01-03T12:00:00Z';
    expect(calculateTimeUntilExpiry(twoDaysLater)).toBe('2 days');
  });

  it('should return singular "day" for exactly 1 day', () => {
    const oneDayLater = '2025-01-02T12:00:00Z';
    expect(calculateTimeUntilExpiry(oneDayLater)).toBe('1 day');
  });

  it('should return hours for expiry less than 24 hours away', () => {
    const fiveHoursLater = '2025-01-01T17:00:00Z';
    expect(calculateTimeUntilExpiry(fiveHoursLater)).toBe('5 hours');
  });

  it('should return singular "hour" for exactly 1 hour', () => {
    const oneHourLater = '2025-01-01T13:00:00Z';
    expect(calculateTimeUntilExpiry(oneHourLater)).toBe('1 hour');
  });

  it('should return minutes for expiry less than 1 hour away', () => {
    const thirtyMinutesLater = '2025-01-01T12:30:00Z';
    expect(calculateTimeUntilExpiry(thirtyMinutesLater)).toBe('30 minutes');
  });

  it('should return singular "minute" for exactly 1 minute', () => {
    const oneMinuteLater = '2025-01-01T12:01:00Z';
    expect(calculateTimeUntilExpiry(oneMinuteLater)).toBe('1 minute');
  });

  it('should return "Less than 1 minute" for very short time', () => {
    const thirtySecondsLater = '2025-01-01T12:00:30Z';
    expect(calculateTimeUntilExpiry(thirtySecondsLater)).toBe('Less than 1 minute');
  });

  it('should only show the largest time unit', () => {
    const oneDayFiveHours = '2025-01-02T17:00:00Z'; // 1 day 5 hours
    expect(calculateTimeUntilExpiry(oneDayFiveHours)).toBe('1 day');
  });
});

describe('getStatusBadgeVariant', () => {
  it('should return "default" for pending status', () => {
    expect(getStatusBadgeVariant('pending')).toBe('default');
  });

  it('should return "secondary" for accepted status', () => {
    expect(getStatusBadgeVariant('accepted')).toBe('secondary');
  });

  it('should return "outline" for expired status', () => {
    expect(getStatusBadgeVariant('expired')).toBe('outline');
  });

  it('should return "destructive" for cancelled status', () => {
    expect(getStatusBadgeVariant('cancelled')).toBe('destructive');
  });

  it('should return "outline" for unknown status', () => {
    expect(getStatusBadgeVariant('unknown')).toBe('outline');
  });
});
