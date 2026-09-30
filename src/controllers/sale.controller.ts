import { Response, NextFunction } from 'express';
import { SaleService } from '../services/sale.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class SaleController {
  static async logSale(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const cashierId = req.user!.userId;
      const { items, paymentMethod, notes } = req.body;

      const sale = await SaleService.logSale({
        shopId,
        cashierId,
        items,
        paymentMethod,
        notes,
      });

      res.status(201).json({
        success: true,
        message: 'Sale logged successfully. Stock updated & thresholds verified.',
        data: sale,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSalesHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const { startDate, endDate, cashierId, limit, page } = req.query;

      const history = await SaleService.getSalesHistory(shopId, {
        startDate: startDate as string,
        endDate: endDate as string,
        cashierId: cashierId ? Number(cashierId) : undefined,
        limit: limit ? Number(limit) : undefined,
        page: page ? Number(page) : undefined,
      });

      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSaleById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const saleId = parseInt(req.params.saleId, 10);

      const sale = await SaleService.getSaleById(saleId, shopId);
      res.status(200).json({
        success: true,
        data: sale,
      });
    } catch (error) {
      next(error);
    }
  }
}
