import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { prisma } from '../config/prisma';
import { Role, SubscriptionStatus } from '@prisma/client';

export interface AuthUserPayload {
  userId: number;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ success: false, message: 'Invalid or expired authentication token.' });
    return;
  }
};

export const requireRoles = (roles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    if (req.user.role === Role.SUPER_ADMIN) {
      next();
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden. Action requires one of the following roles: ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
};

export const checkShopAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const shopIdRaw = req.params.shopId || req.body.shopId || req.query.shopId;
    if (!shopIdRaw) {
      res.status(400).json({ success: false, message: 'Shop ID is required for this operation.' });
      return;
    }

    const shopId = parseInt(shopIdRaw as string, 10);
    if (isNaN(shopId)) {
      res.status(400).json({ success: false, message: 'Invalid Shop ID provided.' });
      return;
    }

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      res.status(404).json({ success: false, message: 'Shop not found.' });
      return;
    }

    // Super Admin has master access
    if (req.user?.role === Role.SUPER_ADMIN) {
      next();
      return;
    }

    // Owner check: If user is OWNER, verify ownership
    if (req.user?.role === Role.OWNER && shop.ownerId !== req.user.userId) {
      res.status(403).json({ success: false, message: 'Access denied. You do not own this shop.' });
      return;
    }

    // Manager / Cashier check: Verify assigned shop
    if ((req.user?.role === Role.MANAGER || req.user?.role === Role.CASHIER)) {
      const dbUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (dbUser?.shopId !== shopId && shop.ownerId !== req.user.userId) {
        res.status(403).json({ success: false, message: 'Access denied. You are not assigned to this shop.' });
        return;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const checkSubscriptionActive = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user?.role === Role.SUPER_ADMIN) {
      next();
      return;
    }

    const shopIdRaw = req.params.shopId || req.body.shopId || req.query.shopId;
    if (!shopIdRaw) {
      next();
      return;
    }

    const shopId = parseInt(shopIdRaw as string, 10);
    if (isNaN(shopId)) {
      next();
      return;
    }

    const subscription = await prisma.shopSubscription.findUnique({
      where: { shopId },
    });

    if (!subscription) {
      res.status(402).json({
        success: false,
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Subscription payment required to access store operations.',
      });
      return;
    }

    const now = new Date();
    const endDate = subscription.endDate ? new Date(subscription.endDate) : null;
    const isExpired =
      subscription.status === SubscriptionStatus.EXPIRED ||
      (subscription.status === SubscriptionStatus.ACTIVE && endDate && endDate < now);

    if (subscription.status === SubscriptionStatus.PENDING_APPROVAL) {
      res.status(402).json({
        success: false,
        code: 'SUBSCRIPTION_PENDING',
        message: 'Your subscription payment is currently pending Super Admin approval.',
      });
      return;
    }

    if (isExpired || subscription.status === SubscriptionStatus.REJECTED) {
      res.status(402).json({
        success: false,
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'Your store subscription has expired or was rejected. Please renew your package.',
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
