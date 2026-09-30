import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';
import { AlertService } from './alert.service';

export interface CreateProductDTO {
  categoryId: number;
  name: string;
  sku?: string;
  barcode?: string;
  stockQuantity: number;
  lowStockThreshold?: number;
  costPrice: number;
  sellingPrice: number;
  unit?: string;
}

export interface UpdateProductDTO {
  categoryId?: number;
  name?: string;
  sku?: string;
  barcode?: string;
  stockQuantity?: number;
  lowStockThreshold?: number;
  costPrice?: number;
  sellingPrice?: number;
  unit?: string;
  isActive?: boolean;
}

export class ProductService {
  static async createProduct(shopId: number, data: CreateProductDTO) {
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, shopId },
    });

    if (!category) {
      throw new AppError('Invalid category for this shop.', 400);
    }

    const product = await prisma.product.create({
      data: {
        shopId,
        categoryId: data.categoryId,
        name: data.name,
        sku: data.sku,
        barcode: data.barcode,
        stockQuantity: data.stockQuantity,
        lowStockThreshold: data.lowStockThreshold ?? 10,
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice,
        unit: data.unit || 'pcs',
      },
      include: { category: true },
    });

    // Check if initial stock is already low
    if (product.stockQuantity <= product.lowStockThreshold) {
      await AlertService.checkAndTriggerLowStockAlert(product.shopId, product);
    }

    return product;
  }

  static async getProducts(
    shopId: number,
    query?: { categoryId?: number; lowStock?: boolean; search?: string }
  ) {
    const where: any = { shopId, isActive: true };

    if (query?.categoryId) {
      where.categoryId = Number(query.categoryId);
    }

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { barcode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    if (query?.lowStock) {
      return products.filter((p) => p.stockQuantity <= p.lowStockThreshold);
    }

    return products;
  }

  static async getProductById(id: number, shopId: number) {
    const product = await prisma.product.findFirst({
      where: { id, shopId },
      include: { category: true },
    });

    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    return product;
  }

  static async updateProduct(id: number, shopId: number, data: UpdateProductDTO) {
    const existing = await this.getProductById(id, shopId);

    const updated = await prisma.product.update({
      where: { id },
      data,
      include: { category: true },
    });

    // Check low stock condition after update
    if (updated.stockQuantity <= updated.lowStockThreshold) {
      await AlertService.checkAndTriggerLowStockAlert(shopId, updated);
    }

    return updated;
  }

  static async adjustStock(id: number, shopId: number, adjustment: number) {
    const product = await this.getProductById(id, shopId);
    const newQuantity = product.stockQuantity + adjustment;

    if (newQuantity < 0) {
      throw new AppError(`Cannot reduce stock below 0. Current stock: ${product.stockQuantity}`, 400);
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { stockQuantity: newQuantity },
      include: { category: true },
    });

    if (updated.stockQuantity <= updated.lowStockThreshold) {
      await AlertService.checkAndTriggerLowStockAlert(shopId, updated);
    }

    return updated;
  }

  static async deleteProduct(id: number, shopId: number) {
    await this.getProductById(id, shopId);
    // Soft delete by setting isActive to false to retain historical sales accuracy
    return prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
