import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { ENV } from './config/env';

const app: Application = express();

// Security HTTP Headers with Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Dynamic CORS configuration
const allowedOrigins = ENV.CORS_ORIGIN.split(',').map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, tests)
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS error: Origin '${origin}' is not permitted.`));
      }
    },
    credentials: true,
  })
);

// Global API Rate Limiter
export const apiLimiter = rateLimit({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max: ENV.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMIT_TEST !== 'true',
  message: {
    success: false,
    message: 'Too many requests from this client, please try again after 15 minutes.',
  },
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint (not rate-limited for monitoring & Docker healthchecks)
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'online',
    system: 'myshop_backend',
    timestamp: new Date().toISOString(),
  });
});

// API Routes with rate limiting
app.use('/api', apiLimiter, routes);

// Global Error Handler
app.use(errorHandler);

export default app;
