import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ENV } from './env';
import { prisma } from './prisma';
import { Role } from '@prisma/client';

export interface SocketUserPayload {
  userId: number;
  email: string;
  role: Role;
}

let io: SocketIOServer | null = null;

import { isOriginAllowed } from './cors';

export const initSocket = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  // Socket Handshake Authentication Middleware
  io.use((socket: Socket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const rawToken =
        socket.handshake.auth?.token ||
        (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader);

      if (rawToken) {
        const decoded = jwt.verify(rawToken, ENV.JWT_SECRET) as SocketUserPayload;
        socket.data.user = decoded;
      }
      next();
    } catch (err) {
      console.warn(`[Socket.io] Unauthenticated or invalid token on socket ${socket.id}`);
      // Allow unauthenticated connection for public status, but room access requires auth
      next();
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as SocketUserPayload | undefined;
    console.log(`[Socket.io] Client connected: ${socket.id} (User: ${user ? user.email : 'Anonymous'})`);

    // Client registers to a shop-specific room with access verification
    socket.on('join_shop', async (shopId: number | string) => {
      try {
        const targetShopId = parseInt(shopId.toString(), 10);
        if (isNaN(targetShopId)) {
          socket.emit('socket_error', { message: 'Invalid shop ID provided.' });
          return;
        }

        const socketUser = socket.data.user as SocketUserPayload | undefined;
        if (!socketUser) {
          socket.emit('socket_error', {
            message: 'Authentication required. Please provide a valid Bearer token to join shop channels.',
          });
          return;
        }

        // Verify shop existence
        const shop = await prisma.shop.findUnique({
          where: { id: targetShopId },
        });

        if (!shop) {
          socket.emit('socket_error', { message: `Shop #${targetShopId} not found.` });
          return;
        }

        // Role & Ownership Verification
        if (socketUser.role !== Role.SUPER_ADMIN) {
          if (socketUser.role === Role.OWNER && shop.ownerId !== socketUser.userId) {
            socket.emit('socket_error', { message: 'Access denied: You are not the owner of this shop.' });
            return;
          }

          if (socketUser.role === Role.MANAGER || socketUser.role === Role.CASHIER) {
            const dbUser = await prisma.user.findUnique({ where: { id: socketUser.userId } });
            if (dbUser?.shopId !== targetShopId && shop.ownerId !== socketUser.userId) {
              socket.emit('socket_error', {
                message: 'Access denied: You are not assigned to this shop.',
              });
              return;
            }
          }
        }

        const room = `shop_${targetShopId}`;
        socket.join(room);
        console.log(`[Socket.io] Socket ${socket.id} (${socketUser.email}) joined authorized room: ${room}`);
        socket.emit('joined_room', { room, shopId: targetShopId, authorized: true });
      } catch (err: any) {
        console.error('[Socket.io] Error in join_shop handler:', err);
        socket.emit('socket_error', { message: 'Internal error while joining shop stream.' });
      }
    });

    socket.on('leave_shop', (shopId: number | string) => {
      const room = `shop_${shopId}`;
      socket.leave(room);
      console.log(`[Socket.io] Socket ${socket.id} left room: ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io has not been initialized!');
  }
  return io;
};

export const emitToShop = (shopId: number, event: string, payload: any) => {
  if (io) {
    const room = `shop_${shopId}`;
    io.to(room).emit(event, payload);
    console.log(`[Socket.io Broadcast] Event '${event}' emitted to room '${room}'`);
  }
};
