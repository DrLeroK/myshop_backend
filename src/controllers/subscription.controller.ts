import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { SubscriptionService } from '../services/subscription.service';

export class SubscriptionController {
  static getPackages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = SubscriptionService.getPackages();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async registerOwnerWithShop(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { email, password, name, shopName, address, phone, currency, packageType, paymentProofUrl } = req.body;

      if (!email || !password || !name || !shopName || !packageType) {
        res.status(400).json({ success: false, message: 'Missing required registration fields.' });
        return;
      }

      const result = await SubscriptionService.registerOwnerWithShop({
        email,
        password,
        name,
        shopName,
        address,
        phone,
        currency,
        packageType,
        paymentProofUrl: paymentProofUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800',
      });

      res.status(201).json({
        success: true,
        message: 'Owner registered & store created. Awaiting Super Admin payment approval.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async submitRenewalPayment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = req.user!.userId;
      const { shopId, packageType, paymentProofUrl } = req.body;

      if (!shopId || !packageType || !paymentProofUrl) {
        res.status(400).json({ success: false, message: 'Shop ID, package type, and payment proof screenshot are required.' });
        return;
      }

      const subscription = await SubscriptionService.submitRenewalPayment({
        ownerId,
        shopId: Number(shopId),
        packageType,
        paymentProofUrl,
      });

      res.status(200).json({
        success: true,
        message: 'Renewal payment proof submitted successfully. Awaiting Super Admin review.',
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getShopSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const details = await SubscriptionService.getShopSubscriptionDetails(shopId);
      res.status(200).json({ success: true, data: details });
    } catch (error) {
      next(error);
    }
  }
}
