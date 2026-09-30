import { prisma } from '../config/prisma';
import { emitToShop } from '../config/socket';
import { AlertType, AlertSeverity } from '@prisma/client';

export class AlertService {
  /**
   * Triggers Low Stock Alert if stock falls below threshold
   */
  static async checkAndTriggerLowStockAlert(shopId: number, product: any) {
    if (product.stockQuantity <= product.lowStockThreshold) {
      // Check if an unread alert already exists to prevent duplicate spamming
      const existingAlert = await prisma.alert.findFirst({
        where: {
          shopId,
          productId: product.id,
          type: AlertType.LOW_STOCK,
          isRead: false,
        },
      });

      if (!existingAlert) {
        const title = `Low Stock Alert: ${product.name}`;
        const message = `Stock for '${product.name}' has dropped to ${product.stockQuantity} ${product.unit} (Threshold: ${product.lowStockThreshold}). Please restock soon!`;

        const alert = await prisma.alert.create({
          data: {
            shopId,
            productId: product.id,
            type: AlertType.LOW_STOCK,
            severity: product.stockQuantity === 0 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
            title,
            message,
          },
        });

        // Real-time broadcast to connected client room
        emitToShop(shopId, 'low_stock_alert', alert);
        return alert;
      }
    }
    return null;
  }

  /**
   * Triggers Sales Spike Alert if item sales velocity in past 1 hour exceeds threshold
   */
  static async checkAndTriggerSalesSpikeAlert(shopId: number, product: any, quantitySoldNow: number) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Sum sales for this product in past hour
    const recentItems = await prisma.saleItem.aggregate({
      where: {
        productId: product.id,
        sale: {
          shopId,
          createdAt: { gte: oneHourAgo },
        },
      },
      _sum: {
        quantity: true,
      },
    });

    const totalRecentQuantity = (recentItems._sum.quantity || 0) + quantitySoldNow;

    // Define spike threshold (e.g. 15+ units in 1 hour)
    if (totalRecentQuantity >= 15) {
      const title = `Sales Spike Alert: ${product.name}`;
      const message = `Rapid sales detected! '${product.name}' sold ${totalRecentQuantity} units in the last hour. Verify stock levels to prevent stockouts!`;

      const alert = await prisma.alert.create({
        data: {
          shopId,
          productId: product.id,
          type: AlertType.SALES_SPIKE,
          severity: AlertSeverity.INFO,
          title,
          message,
        },
      });

      emitToShop(shopId, 'sales_spike_alert', alert);
      return alert;
    }
    return null;
  }

  /**
   * Check for Unusually Low Sales Day (e.g. daily sales < 30% of average daily revenue)
   */
  static async checkUnusuallyLowSalesDay(shopId: number) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Today's total sales
    const todaySales = await prisma.sale.aggregate({
      where: {
        shopId,
        createdAt: { gte: startOfToday },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const historicalSales = await prisma.sale.aggregate({
      where: {
        shopId,
        createdAt: { gte: thirtyDaysAgo, lt: startOfToday },
      },
      _sum: { totalAmount: true },
    });

    const historicalTotal = Number(historicalSales._sum.totalAmount || 0);
    const averageDailyRevenue = historicalTotal / 30;
    const todayRevenue = Number(todaySales._sum.totalAmount || 0);

    // If current time is late in the day (after 18:00) and revenue is under 25% of average
    if (now.getHours() >= 18 && averageDailyRevenue > 0 && todayRevenue < averageDailyRevenue * 0.25) {
      const title = `Unusually Low Sales Day Warning`;
      const message = `Today's revenue (${todayRevenue.toFixed(2)}) is down significantly compared to your 30-day daily average (${averageDailyRevenue.toFixed(2)}). Consider checking foot traffic or marketing.`;

      const alert = await prisma.alert.create({
        data: {
          shopId,
          type: AlertType.UNUSUALLY_LOW_SALES,
          severity: AlertSeverity.WARNING,
          title,
          message,
        },
      });

      emitToShop(shopId, 'low_sales_alert', alert);
      return alert;
    }
    return null;
  }

  static async getAlerts(shopId: number, unreadOnly: boolean = false) {
    return prisma.alert.findMany({
      where: {
        shopId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, stockQuantity: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  static async markAsRead(alertId: number, shopId: number) {
    return prisma.alert.updateMany({
      where: { id: alertId, shopId },
      data: { isRead: true },
    });
  }

  static async markAllAsRead(shopId: number) {
    return prisma.alert.updateMany({
      where: { shopId, isRead: false },
      data: { isRead: true },
    });
  }
}
