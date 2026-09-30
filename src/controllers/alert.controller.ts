import { Response, NextFunction } from 'express';
import { AlertService } from '../services/alert.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class AlertController {
  static async getAlerts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const { unreadOnly } = req.query;

      const alerts = await AlertService.getAlerts(shopId, unreadOnly === 'true');
      res.status(200).json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      next(error);
    }
  }

  static async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const alertId = parseInt(req.params.alertId, 10);

      await AlertService.markAsRead(alertId, shopId);
      res.status(200).json({
        success: true,
        message: 'Alert marked as read.',
      });
    } catch (error) {
      next(error);
    }
  }

  static async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);

      await AlertService.markAllAsRead(shopId);
      res.status(200).json({
        success: true,
        message: 'All shop alerts marked as read.',
      });
    } catch (error) {
      next(error);
    }
  }

  static async triggerLowSalesCheck(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const alert = await AlertService.checkUnusuallyLowSalesDay(shopId);

      res.status(200).json({
        success: true,
        message: alert ? 'Low sales warning triggered.' : 'Sales levels normal, no alert needed.',
        data: alert,
      });
    } catch (error) {
      next(error);
    }
  }
}
