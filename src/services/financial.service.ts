import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export class FinancialService {
  /**
   * Helper to derive start and end dates based on specified period
   */
  private static getDateRange(period: 'daily' | 'weekly' | 'monthly' | 'all' | 'custom' = 'monthly'): DateRange {
    const now = new Date();
    let startDate: Date;
    const endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (period === 'weekly') {
      const dayOfWeek = now.getDay();
      startDate = new Date(now.setDate(now.getDate() - dayOfWeek));
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else {
      startDate = new Date(0); // Beginning of time
    }

    return { startDate, endDate };
  }

  /**
   * Live SQL / Prisma Aggregation: Comprehensive Financial Summary (Revenue, COGS, Gross Profit, Expenses, Net Profit, Margins)
   */
  static async getFinancialSummary(
    shopId: number,
    period: 'daily' | 'weekly' | 'monthly' | 'all' | 'custom' = 'monthly',
    customStart?: string,
    customEnd?: string
  ) {
    let startDate: Date;
    let endDate: Date;

    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
    } else {
      const range = this.getDateRange(period);
      startDate = range.startDate;
      endDate = range.endDate;
    }

    // 1. Sales Aggregation via SQL / Prisma
    const salesAggregate = await prisma.sale.aggregate({
      where: {
        shopId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: {
        totalAmount: true,
        totalCost: true,
        grossProfit: true,
      },
      _count: {
        id: true,
      },
    });

    const revenue = Number(salesAggregate._sum.totalAmount || 0);
    const cogs = Number(salesAggregate._sum.totalCost || 0);
    const grossProfit = Number(salesAggregate._sum.grossProfit || 0);
    const salesCount = salesAggregate._count.id;
    const averageOrderValue = salesCount > 0 ? revenue / salesCount : 0;
    const grossMarginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    // 2. Expenses Aggregation
    const expenseAggregate = await prisma.expense.aggregate({
      where: {
        shopId,
        expenseDate: { gte: startDate, lte: endDate },
      },
      _sum: {
        amount: true,
      },
    });

    const totalExpenses = Number(expenseAggregate._sum.amount || 0);
    const netProfit = grossProfit - totalExpenses;
    const netMarginPercent = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      shopId,
      period,
      timeframe: {
        startDate,
        endDate,
      },
      metrics: {
        revenue: Number(revenue.toFixed(2)),
        costOfGoodsSold: Number(cogs.toFixed(2)),
        grossProfit: Number(grossProfit.toFixed(2)),
        grossMarginPercent: Number(grossMarginPercent.toFixed(2)),
        operatingExpenses: Number(totalExpenses.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        netMarginPercent: Number(netMarginPercent.toFixed(2)),
        totalSalesCount: salesCount,
        averageOrderValue: Number(averageOrderValue.toFixed(2)),
      },
    };
  }

  /**
   * Live Best-Selling Products Reporting (Ranked by quantity or revenue)
   */
  static async getBestSellingProducts(
    shopId: number,
    limit: number = 10,
    period: 'daily' | 'weekly' | 'monthly' | 'all' = 'monthly'
  ) {
    const { startDate, endDate } = this.getDateRange(period);

    // SQL Aggregation on SaleItem joined with Sale
    const topItems = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          shopId,
          createdAt: { gte: startDate, lte: endDate },
        },
      },
      _sum: {
        quantity: true,
        subtotal: true,
        profit: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: limit,
    });

    const productIds = topItems.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
        sellingPrice: true,
        unit: true,
        category: { select: { name: true } },
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    return topItems.map((item, rank) => {
      const product = productMap.get(item.productId);
      return {
        rank: rank + 1,
        productId: item.productId,
        productName: product?.name || 'Unknown Product',
        sku: product?.sku,
        categoryName: product?.category.name,
        currentStock: product?.stockQuantity,
        totalQuantitySold: item._sum.quantity || 0,
        totalRevenue: Number((item._sum.subtotal || 0).toFixed(2)),
        totalProfit: Number((item._sum.profit || 0).toFixed(2)),
      };
    });
  }

  /**
   * Trend Comparison Report: "This week vs Last week" or "Today vs Yesterday"
   */
  static async getTrendComparison(
    shopId: number,
    type: 'this_week_vs_last_week' | 'today_vs_yesterday' = 'this_week_vs_last_week'
  ) {
    const now = new Date();
    let currentStart: Date;
    let currentEnd: Date;
    let previousStart: Date;
    let previousEnd: Date;

    if (type === 'today_vs_yesterday') {
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      previousStart = new Date(currentStart.getTime() - 24 * 60 * 60 * 1000);
      previousEnd = new Date(currentEnd.getTime() - 24 * 60 * 60 * 1000);
    } else {
      // This week vs Last week
      const dayOfWeek = now.getDay();
      currentStart = new Date(now.setDate(now.getDate() - dayOfWeek));
      currentStart.setHours(0, 0, 0, 0);
      currentEnd = new Date();

      previousStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousEnd = new Date(currentStart.getTime() - 1);
    }

    const [currentSummary, previousSummary] = await Promise.all([
      this.getFinancialSummary(shopId, 'custom', currentStart.toISOString(), currentEnd.toISOString()),
      this.getFinancialSummary(shopId, 'custom', previousStart.toISOString(), previousEnd.toISOString()),
    ]);

    const revCurr = currentSummary.metrics.revenue;
    const revPrev = previousSummary.metrics.revenue;
    const revenueGrowthPercent = revPrev > 0 ? ((revCurr - revPrev) / revPrev) * 100 : revCurr > 0 ? 100 : 0;

    const countCurr = currentSummary.metrics.totalSalesCount;
    const countPrev = previousSummary.metrics.totalSalesCount;
    const salesCountGrowthPercent = countPrev > 0 ? ((countCurr - countPrev) / countPrev) * 100 : countCurr > 0 ? 100 : 0;

    const profitCurr = currentSummary.metrics.netProfit;
    const profitPrev = previousSummary.metrics.netProfit;
    const profitGrowthPercent = profitPrev !== 0 ? ((profitCurr - profitPrev) / Math.abs(profitPrev)) * 100 : profitCurr > 0 ? 100 : 0;

    return {
      shopId,
      comparisonType: type,
      currentPeriod: {
        startDate: currentStart,
        endDate: currentEnd,
        revenue: revCurr,
        salesCount: countCurr,
        netProfit: profitCurr,
      },
      previousPeriod: {
        startDate: previousStart,
        endDate: previousEnd,
        revenue: revPrev,
        salesCount: countPrev,
        netProfit: profitPrev,
      },
      percentageChanges: {
        revenueGrowthPercent: Number(revenueGrowthPercent.toFixed(2)),
        salesCountGrowthPercent: Number(salesCountGrowthPercent.toFixed(2)),
        profitGrowthPercent: Number(profitGrowthPercent.toFixed(2)),
      },
    };
  }

  /**
   * Revenue Split by Payment Method (Cash, Card, Mobile Money)
   */
  static async getPaymentMethodBreakdown(shopId: number, period: 'daily' | 'weekly' | 'monthly' | 'all' = 'monthly') {
    const { startDate, endDate } = this.getDateRange(period);

    const breakdown = await prisma.sale.groupBy({
      by: ['paymentMethod'],
      where: {
        shopId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    });

    return breakdown.map((b) => ({
      paymentMethod: b.paymentMethod,
      totalRevenue: Number((b._sum.totalAmount || 0).toFixed(2)),
      transactionCount: b._count.id,
    }));
  }
}
