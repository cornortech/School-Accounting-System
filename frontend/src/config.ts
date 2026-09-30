// App-wide settings. Change APP_NAME here to rename the product everywhere.
export const APP_NAME = 'EduLedger';
export const APP_TAGLINE = 'School accounts, fees & payroll';

// Backend address (set VITE_API_URL in .env locally and on Vercel)
export const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:5000').trim().replace(/\/+$/, '');
