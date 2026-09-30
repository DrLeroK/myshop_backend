import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';
import { PaymentMethod, Prisma } from '@prisma/client';
import { AlertService } from './alert.service';
import { emitToShop } from '../config/socket';

export interface CreateSaleItemDTO {
  productId: number;
  quantity: number;
  customUnitPrice?: number; // Optional discount/custom price override
}

export interface CreateSaleDTO {
  shopId: number;
  cashierId: number;
  items: CreateSaleItemDTO[];
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export class SaleService {
  /**
   * Core Transaction Engine:
   * 1 Write Action -> 3 Connected System Consequences:
   *  Consequence 1: Decrement Product Stock Atomically
   *  Consequence 2: Record Historic Sale & Revenue Transaction
   *  Consequence 3: Check Thresholds & Trigger Real-Time Socket.io Alerts
   */
  static async logSale(dto: CreateSaleDTO) {
    if (!dto.items || dto.items.length === 0) {
      throw new AppError('Sale must include at least one product item.', 400);
    }

    // Fetch products to validate existence and stock
    const productIds = dto.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        shopId: dto.shopId,
        isActive: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new AppError('One or more requested products were not found or are inactive.', 400);
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Validate stock levels before transaction
    for (const item of dto.items) {
      const product = productMap.get(item.productId)!;
      if (item.quantity <= 0) {
        throw new AppError(`Quantity for product '${product.name}' must be greater than 0.`, 400);
      }
      if (product.stockQuantity < item.quantity) {
        throw new AppError(
          `Insufficient stock for '${product.name}'. Available: ${product.stockQuantity}, Requested: ${item.quantity}`,
          400
        );
      }
    }

    // Execute atomic transaction: Stock decrement + Sale logging
    const saleResult = await prisma.$transaction(async (tx) => {
      let grandTotalAmount = new Prisma.Decimal(0);
      let grandTotalCost = new Prisma.Decimal(0);

      const preparedItems = [];
      const updatedProducts = [];

      for (const item of dto.items) {
        const product = productMap.get(item.productId)!;
        const unitPrice = item.customUnitPrice !== undefined ? new Prisma.Decimal(item.customUnitPrice) : product.sellingPrice;
        const unitCost = product.costPrice;

        const subtotal = unitPrice.mul(item.quantity);
        const itemCost = unitCost.mul(item.quantity);
        const itemProfit = subtotal.sub(itemCost);

        grandTotalAmount = grandTotalAmount.add(subtotal);
        grandTotalCost = grandTotalCost.add(itemCost);

        // 1. Decrement Stock Atomically
        const updatedProduct = await tx.product.update({
          where: { id: product.id },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });
        updatedProducts.push(updatedProduct);

        preparedItems.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice,
          unitCost,
          subtotal,
          profit: itemProfit,
        });
      }

      const grossProfit = grandTotalAmount.sub(grandTotalCost);
      const saleNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

      // 2. Add to Revenue & Record Sale Event
      const sale = await tx.sale.create({
        data: {
          saleNumber,
          shopId: dto.shopId,
          cashierId: dto.cashierId,
          totalAmount: grandTotalAmount,
          totalCost: grandTotalCost,
          grossProfit,
          paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
          notes: dto.notes,
          saleItems: {
            create: preparedItems,
          },
        },
        include: {
          saleItems: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, unit: true },
              },
            },
          },
          cashier: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return { sale, updatedProducts };
    });

    // 3. Post-write consequences: Check thresholds & trigger real-time alerts
    for (const updatedProduct of saleResult.updatedProducts) {
      const saleItem = dto.items.find((i) => i.productId === updatedProduct.id);

      // Check Low Stock Threshold
      await AlertService.checkAndTriggerLowStockAlert(dto.shopId, updatedProduct);

      // Check Sales Spike Velocity
      if (saleItem) {
        await AlertService.checkAndTriggerSalesSpikeAlert(dto.shopId, updatedProduct, saleItem.quantity);
      }
    }

    // Broadcast Real-Time Socket.io Event to Shop Room
    emitToShop(dto.shopId, 'sale_created', {
      sale: saleResult.sale,
      updatedProducts: saleResult.updatedProducts.map((p) => ({
        id: p.id,
        name: p.name,
        stockQuantity: p.stockQuantity,
        lowStockThreshold: p.lowStockThreshold,
      })),
    });

    return saleResult.sale;
  }

  static async getSalesHistory(
    shopId: number,
    query?: { startDate?: string; endDate?: string; cashierId?: number; limit?: number; page?: number }
  ) {
    const limit = query?.limit ? Number(query.limit) : 20;
    const page = query?.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;

    const where: any = { shopId };

    if (query?.cashierId) {
      where.cashierId = Number(query.cashierId);
    }

    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [total, sales] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        include: {
          saleItems: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, unit: true },
              },
            },
          },
          cashier: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      totalPages: Math.ceil(total / limit),
      sales,
    };
  }

  static async getSaleById(id: number, shopId: number) {
    const sale = await prisma.sale.findFirst({
      where: { id, shopId },
      include: {
        saleItems: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, unit: true, category: true },
            },
          },
        },
        cashier: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!sale) {
      throw new AppError('Sale record not found.', 404);
    }

    return sale;
  }
}
