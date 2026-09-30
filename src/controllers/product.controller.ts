import { Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class ProductController {
  static async createProduct(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const product = await ProductService.createProduct(shopId, req.body);
      res.status(201).json({
        success: true,
        message: 'Product created successfully.',
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProducts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const { categoryId, lowStock, search } = req.query;

      const products = await ProductService.getProducts(shopId, {
        categoryId: categoryId ? Number(categoryId) : undefined,
        lowStock: lowStock === 'true',
        search: search as string,
      });

      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProductById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const productId = parseInt(req.params.productId, 10);
      const product = await ProductService.getProductById(productId, shopId);
      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateProduct(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const productId = parseInt(req.params.productId, 10);
      const updated = await ProductService.updateProduct(productId, shopId, req.body);
      res.status(200).json({
        success: true,
        message: 'Product updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async adjustStock(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const productId = parseInt(req.params.productId, 10);
      const { adjustment } = req.body; // e.g. +5 or -2
      const updated = await ProductService.adjustStock(productId, shopId, Number(adjustment));
      res.status(200).json({
        success: true,
        message: 'Stock adjusted successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteProduct(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const productId = parseInt(req.params.productId, 10);
      await ProductService.deleteProduct(productId, shopId);
      res.status(200).json({
        success: true,
        message: 'Product deactivated successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
}
