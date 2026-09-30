import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { ENV } from '../config/env';

const router = Router();

// Strict Auth Limiter for sensitive endpoints
export const authLimiter = rateLimit({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max: ENV.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMIT_TEST !== 'true',
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.get('/profile', authenticateToken, AuthController.getProfile);

export default router;
