import { Response, NextFunction } from 'express';
import { ShopService } from '../services/shop.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class ShopController {
  static async createShop(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = req.user!.userId;
      const shop = await ShopService.createShop(ownerId, req.body);
      res.status(201).json({
        success: true,
        message: 'Shop created successfully.',
        data: shop,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyShops(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shops = await ShopService.getShopsByOwner(req.user!.userId);
      res.status(200).json({
        success: true,
        data: shops,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getShopById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const shop = await ShopService.getShopById(shopId);
      res.status(200).json({
        success: true,
        data: shop,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateShop(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const updated = await ShopService.updateShop(shopId, req.body);
      res.status(200).json({
        success: true,
        message: 'Shop updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteShop(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      await ShopService.deleteShop(shopId);
      res.status(200).json({
        success: true,
        message: 'Shop deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getOwnerAggregatedDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = req.user!.userId;
      const { period } = req.query;

      const dashboard = await ShopService.getOwnerAggregatedDashboard(
        ownerId,
        (period as any) || 'monthly'
      );

      res.status(200).json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      next(error);
    }
  }

  static async transferStock(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = req.user!.userId;
      const { sourceShopId, targetShopId, productId, quantity } = req.body;

      const result = await ShopService.transferStockBetweenShops(ownerId, {
        sourceShopId: Number(sourceShopId),
        targetShopId: Number(targetShopId),
        productId: Number(productId),
        quantity: Number(quantity),
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
