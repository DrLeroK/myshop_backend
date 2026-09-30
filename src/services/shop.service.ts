import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';
import { FinancialService } from './financial.service';

export class ShopService {
  static async createShop(ownerId: number, data: { name: string; address?: string; phone?: string; currency?: string }) {
    const shop = await prisma.shop.create({
      data: {
        name: data.name,
        address: data.address,
        phone: data.phone,
        currency: data.currency || 'USD',
        ownerId: ownerId,
      },
    });

    return shop;
  }

  static async getShopsByOwner(ownerId: number) {
    return prisma.shop.findMany({
      where: { ownerId },
      include: {
        _count: {
          select: {
            products: true,
            sales: true,
            expenses: true,
            alerts: { where: { isRead: false } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getShopById(shopId: number) {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            products: true,
            categories: true,
            sales: true,
            alerts: { where: { isRead: false } },
          },
        },
      },
    });

    if (!shop) {
      throw new AppError('Shop not found.', 404);
    }

    return shop;
  }

  static async updateShop(shopId: number, data: { name?: string; address?: string; phone?: string; currency?: string }) {
    return prisma.shop.update({
      where: { id: shopId },
      data,
    });
  }

  static async deleteShop(shopId: number) {
    return prisma.shop.delete({
      where: { id: shopId },
    });
  }

  /**
   * Multi-Shop Feature: Consolidated Financial & Operational Executive Dashboard across ALL shops owned by an owner
   */
  static async getOwnerAggregatedDashboard(ownerId: number, period: 'daily' | 'weekly' | 'monthly' | 'all' = 'monthly') {
    const shops = await prisma.shop.findMany({
      where: { ownerId },
      select: { id: true, name: true, currency: true },
    });

    if (shops.length === 0) {
      return {
        totalShops: 0,
        consolidatedMetrics: {
          totalRevenue: 0,
          totalGrossProfit: 0,
          totalExpenses: 0,
          totalNetProfit: 0,
          totalSalesCount: 0,
          totalUnreadAlerts: 0,
        },
        shopsBreakdown: [],
      };
    }

    const shopsBreakdown = [];
    let consolidatedRevenue = 0;
    let consolidatedGrossProfit = 0;
    let consolidatedExpenses = 0;
    let consolidatedNetProfit = 0;
    let consolidatedSalesCount = 0;
    let consolidatedUnreadAlerts = 0;

    for (const shop of shops) {
      const finSummary = await FinancialService.getFinancialSummary(shop.id, period);
      const unreadAlertsCount = await prisma.alert.count({
        where: { shopId: shop.id, isRead: false },
      });

      const metrics = finSummary.metrics;
      consolidatedRevenue += metrics.revenue;
      consolidatedGrossProfit += metrics.grossProfit;
      consolidatedExpenses += metrics.operatingExpenses;
      consolidatedNetProfit += metrics.netProfit;
      consolidatedSalesCount += metrics.totalSalesCount;
      consolidatedUnreadAlerts += unreadAlertsCount;

      shopsBreakdown.push({
        shopId: shop.id,
        shopName: shop.name,
        currency: shop.currency,
        metrics: {
          revenue: metrics.revenue,
          grossProfit: metrics.grossProfit,
          grossMarginPercent: metrics.grossMarginPercent,
          operatingExpenses: metrics.operatingExpenses,
          netProfit: metrics.netProfit,
          netMarginPercent: metrics.netMarginPercent,
          salesCount: metrics.totalSalesCount,
          unreadAlertsCount,
        },
      });
    }

    const consolidatedGrossMargin = consolidatedRevenue > 0 ? (consolidatedGrossProfit / consolidatedRevenue) * 100 : 0;
    const consolidatedNetMargin = consolidatedRevenue > 0 ? (consolidatedNetProfit / consolidatedRevenue) * 100 : 0;

    return {
      ownerId,
      totalShops: shops.length,
      period,
      consolidatedMetrics: {
        totalRevenue: Number(consolidatedRevenue.toFixed(2)),
        totalGrossProfit: Number(consolidatedGrossProfit.toFixed(2)),
        grossMarginPercent: Number(consolidatedGrossMargin.toFixed(2)),
        totalOperatingExpenses: Number(consolidatedExpenses.toFixed(2)),
        totalNetProfit: Number(consolidatedNetProfit.toFixed(2)),
        netMarginPercent: Number(consolidatedNetMargin.toFixed(2)),
        totalSalesCount: consolidatedSalesCount,
        totalUnreadAlerts: consolidatedUnreadAlerts,
      },
      shopsBreakdown,
    };
  }

  /**
   * Multi-Shop Feature: Inter-Shop Inventory Stock Transfer between shop locations
   */
  static async transferStockBetweenShops(
    ownerId: number,
    dto: {
      sourceShopId: number;
      targetShopId: number;
      productId: number;
      quantity: number;
    }
  ) {
    const { sourceShopId, targetShopId, productId, quantity } = dto;

    if (sourceShopId === targetShopId) {
      throw new AppError('Source and target shops must be different.', 400);
    }

    if (quantity <= 0) {
      throw new AppError('Transfer quantity must be greater than 0.', 400);
    }

    // Verify ownership of both shops
    const shops = await prisma.shop.findMany({
      where: {
        id: { in: [sourceShopId, targetShopId] },
        ownerId,
      },
    });

    if (shops.length !== 2) {
      throw new AppError('Access denied or one of the shops was not found.', 403);
    }

    const sourceShop = shops.find((s) => s.id === sourceShopId)!;
    const targetShop = shops.find((s) => s.id === targetShopId)!;

    // Fetch source product
    const sourceProduct = await prisma.product.findFirst({
      where: { id: productId, shopId: sourceShopId },
      include: { category: true },
    });

    if (!sourceProduct) {
      throw new AppError(`Product not found in source shop '${sourceShop.name}'.`, 404);
    }

    if (sourceProduct.stockQuantity < quantity) {
      throw new AppError(
        `Insufficient stock in '${sourceShop.name}'. Available: ${sourceProduct.stockQuantity}, Requested transfer: ${quantity}`,
        400
      );
    }

    // Perform atomic multi-shop stock transfer
    const result = await prisma.$transaction(async (tx) => {
      // 1. Decrement stock from source shop
      const updatedSourceProduct = await tx.product.update({
        where: { id: sourceProduct.id },
        data: {
          stockQuantity: {
            decrement: quantity,
          },
        },
      });

      // 2. Find or create matching product in target shop (matched by SKU or Name)
      let targetProduct = await tx.product.findFirst({
        where: {
          shopId: targetShopId,
          ...(sourceProduct.sku ? { sku: sourceProduct.sku } : { name: sourceProduct.name }),
        },
      });

      if (!targetProduct) {
        // Ensure category exists in target shop
        let targetCategory = await tx.category.findFirst({
          where: { shopId: targetShopId, name: sourceProduct.category.name },
        });

        if (!targetCategory) {
          targetCategory = await tx.category.create({
            data: {
              shopId: targetShopId,
              name: sourceProduct.category.name,
              description: sourceProduct.category.description,
            },
          });
        }

        // Create product in target shop
        targetProduct = await tx.product.create({
          data: {
            shopId: targetShopId,
            categoryId: targetCategory.id,
            name: sourceProduct.name,
            sku: sourceProduct.sku,
            barcode: sourceProduct.barcode,
            stockQuantity: quantity,
            lowStockThreshold: sourceProduct.lowStockThreshold,
            costPrice: sourceProduct.costPrice,
            sellingPrice: sourceProduct.sellingPrice,
            unit: sourceProduct.unit,
          },
        });
      } else {
        // Increment stock in target shop
        targetProduct = await tx.product.update({
          where: { id: targetProduct.id },
          data: {
            stockQuantity: {
              increment: quantity,
            },
          },
        });
      }

      return { updatedSourceProduct, targetProduct };
    });

    return {
      message: `Successfully transferred ${quantity} ${sourceProduct.unit} of '${sourceProduct.name}' from '${sourceShop.name}' to '${targetShop.name}'.`,
      sourceShop: {
        id: sourceShop.id,
        name: sourceShop.name,
        productStockRemaining: result.updatedSourceProduct.stockQuantity,
      },
      targetShop: {
        id: targetShop.id,
        name: targetShop.name,
        productStockNew: result.targetProduct.stockQuantity,
      },
    };
  }
}
