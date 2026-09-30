import { Response, NextFunction } from 'express';
import { ExpenseService } from '../services/expense.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class ExpenseController {
  static async createExpense(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const userId = req.user!.userId;
      const expense = await ExpenseService.createExpense(shopId, userId, req.body);

      res.status(201).json({
        success: true,
        message: 'Expense recorded successfully.',
        data: expense,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getExpenses(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const { startDate, endDate, category } = req.query;

      const expenses = await ExpenseService.getExpenses(shopId, {
        startDate: startDate as string,
        endDate: endDate as string,
        category: category as any,
      });

      res.status(200).json({
        success: true,
        data: expenses,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteExpense(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const expenseId = parseInt(req.params.expenseId, 10);

      await ExpenseService.deleteExpense(expenseId, shopId);
      res.status(200).json({
        success: true,
        message: 'Expense record deleted.',
      });
    } catch (error) {
      next(error);
    }
  }
}
