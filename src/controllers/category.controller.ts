import { Response, NextFunction } from 'express';
import { CategoryService } from '../services/category.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class CategoryController {
  static async createCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const category = await CategoryService.createCategory(shopId, req.body);
      res.status(201).json({
        success: true,
        message: 'Category created successfully.',
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCategories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const categories = await CategoryService.getCategoriesByShop(shopId);
      res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const categoryId = parseInt(req.params.categoryId, 10);
      const updated = await CategoryService.updateCategory(categoryId, req.body);
      res.status(200).json({
        success: true,
        message: 'Category updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const categoryId = parseInt(req.params.categoryId, 10);
      await CategoryService.deleteCategory(categoryId);
      res.status(200).json({
        success: true,
        message: 'Category deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
}
