import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { SubscriptionService } from '../services/subscription.service';

export class AdminController {
  static async getPendingSubscriptions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const pending = await SubscriptionService.getPendingSubscriptions();
      res.status(200).json({ success: true, data: pending });
    } catch (error) {
      next(error);
    }
  }

  static async approveSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const subscriptionId = parseInt(req.params.subscriptionId, 10);
      const adminUserId = req.user!.userId;
      const { adminNotes } = req.body;

      const subscription = await SubscriptionService.approveSubscription(subscriptionId, adminUserId, adminNotes);
      res.status(200).json({
        success: true,
        message: 'Subscription approved and store activated successfully!',
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  static async rejectSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const subscriptionId = parseInt(req.params.subscriptionId, 10);
      const adminUserId = req.user!.userId;
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json({ success: false, message: 'Rejection reason is required.' });
        return;
      }

      const subscription = await SubscriptionService.rejectSubscription(subscriptionId, adminUserId, reason);
      res.status(200).json({
        success: true,
        message: 'Subscription payment rejected.',
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAdminOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const overview = await SubscriptionService.getAdminOverview();
      res.status(200).json({ success: true, data: overview });
    } catch (error) {
      next(error);
    }
  }
}
