import http from 'http';
import app from './app';
import { ENV } from './config/env';
import { initSocket } from './config/socket';
import { prisma } from './config/prisma';

const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

const startServer = async () => {
  try {
    // Verify DB Connection
    await prisma.$connect();
    console.log('✅ PostgreSQL database connected successfully via Prisma.');

    server.listen(ENV.PORT, '0.0.0.0', () => {
      console.log(`🚀 myshop_backend server is running on http://0.0.0.0:${ENV.PORT} (localhost & network IP)`);
      console.log(`⚡ Socket.io real-time engine ready.`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
