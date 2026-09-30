import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

export class CategoryService {
  static async createCategory(shopId: number, data: { name: string; description?: string }) {
    const existing = await prisma.category.findUnique({
      where: {
        shopId_name: { shopId, name: data.name },
      },
    });

    if (existing) {
      throw new AppError(`Category '${data.name}' already exists in this shop.`, 400);
    }

    return prisma.category.create({
      data: {
        shopId,
        name: data.name,
        description: data.description,
      },
    });
  }

  static async getCategoriesByShop(shopId: number) {
    return prisma.category.findMany({
      where: { shopId },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  static async updateCategory(id: number, data: { name?: string; description?: string }) {
    return prisma.category.update({
      where: { id },
      data,
    });
  }

  static async deleteCategory(id: number) {
    return prisma.category.delete({
      where: { id },
    });
  }
}
