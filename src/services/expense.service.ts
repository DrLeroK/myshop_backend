import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';
import { ExpenseCategory } from '@prisma/client';

export class ExpenseService {
  static async createExpense(
    shopId: number,
    userId: number,
    data: {
      category: ExpenseCategory;
      amount: number;
      description: string;
      expenseDate?: string;
    }
  ) {
    if (data.amount <= 0) {
      throw new AppError('Expense amount must be greater than 0.', 400);
    }

    return prisma.expense.create({
      data: {
        shopId,
        userId,
        category: data.category,
        amount: data.amount,
        description: data.description,
        expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  static async getExpenses(
    shopId: number,
    query?: { startDate?: string; endDate?: string; category?: ExpenseCategory }
  ) {
    const where: any = { shopId };

    if (query?.category) {
      where.category = query.category;
    }

    if (query?.startDate || query?.endDate) {
      where.expenseDate = {};
      if (query.startDate) where.expenseDate.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    return prisma.expense.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { expenseDate: 'desc' },
    });
  }

  static async deleteExpense(id: number, shopId: number) {
    const expense = await prisma.expense.findFirst({
      where: { id, shopId },
    });

    if (!expense) {
      throw new AppError('Expense record not found.', 404);
    }

    return prisma.expense.delete({
      where: { id },
    });
  }
}
