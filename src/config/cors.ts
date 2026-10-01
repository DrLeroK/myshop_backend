import { ENV } from './env';

/**
 * Checks if an origin matches localhost, loopback, or private IPv4 address blocks:
 * - 127.0.0.1
 * - localhost
 * - 10.0.0.0/8 (e.g. 10.124.107.203)
 * - 172.16.0.0/12
 * - 192.168.0.0/16
 */
const isLocalOrPrivateNetwork = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
  } catch {
    return false;
  }
};

/**
 * Determines whether a given request origin should be granted CORS access.
 */
export const isOriginAllowed = (origin: string | undefined): boolean => {
  // Allow requests without origin (e.g. mobile apps, curl, server-to-server, unit tests)
  if (!origin) return true;

  const allowedOrigins = ENV.CORS_ORIGIN.split(',').map((o) => o.trim());

  // Universal wildcard
  if (allowedOrigins.includes('*')) return true;

  // Explicit origin list match
  if (allowedOrigins.includes(origin)) return true;

  // In development and test environments, seamlessly permit local network IPs
  if (ENV.NODE_ENV !== 'production' && isLocalOrPrivateNetwork(origin)) {
    return true;
  }

  // Support wildcard patterns (e.g. *.example.com or http://10.*)
  for (const pattern of allowedOrigins) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      if (regex.test(origin)) return true;
    }
  }

  return false;
};
