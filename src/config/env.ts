import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'myshop_super_secret_jwt_key_2026_prod',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes default
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '15', 10),
};

if (ENV.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16)) {
  console.warn('⚠️ [SECURITY WARNING] In production, JWT_SECRET must be set to a strong custom secret of at least 16 characters.');
}
