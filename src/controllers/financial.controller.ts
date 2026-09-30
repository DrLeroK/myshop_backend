import { Response, NextFunction } from 'express';
import { FinancialService } from '../services/financial.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class FinancialController {
  static async getFinancialSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const { period, startDate, endDate } = req.query;

      const summary = await FinancialService.getFinancialSummary(
        shopId,
        (period as any) || 'monthly',
        startDate as string,
        endDate as string
      );

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBestSellingProducts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const { limit, period } = req.query;

      const bestSellers = await FinancialService.getBestSellingProducts(
        shopId,
        limit ? Number(limit) : 10,
        (period as any) || 'monthly'
      );

      res.status(200).json({
        success: true,
        data: bestSellers,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTrendComparison(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const { type } = req.query;

      const trend = await FinancialService.getTrendComparison(
        shopId,
        (type as any) || 'this_week_vs_last_week'
      );

      res.status(200).json({
        success: true,
        data: trend,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentMethodBreakdown(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const { period } = req.query;

      const breakdown = await FinancialService.getPaymentMethodBreakdown(
        shopId,
        (period as any) || 'monthly'
      );

      res.status(200).json({
        success: true,
        data: breakdown,
      });
    } catch (error) {
      next(error);
    }
  }
}
