'use client';

export const GA_MEASUREMENT_ID = 'G-NZ9HC56HTD';

// Google Analytics 페이지뷰 추적
export const pageview = (url: string) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
    });
  }
};

// Google Analytics 이벤트 추적
export const event = ({ action, category, label, value }: { action: string, category: string, label: string, value: number }) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};
