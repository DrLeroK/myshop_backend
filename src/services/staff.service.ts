import { prisma } from '../config/prisma';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

export class StaffService {
  static async createStaffUser(ownerId: number, shopId: number, dto: { email: string; password: string; name: string; role: Role }) {
    // Verify shop ownership
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop || shop.ownerId !== ownerId) {
      throw new Error('Shop not found or access denied.');
    }

    if (dto.role !== Role.MANAGER && dto.role !== Role.CASHIER) {
      throw new Error('Staff role must be MANAGER or CASHIER.');
    }

    const existingUser = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      throw new Error(`Email ${dto.email} is already registered.`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const staffUser = await prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: dto.role,
        shopId: shopId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        shopId: true,
        createdAt: true,
      },
    });

    return staffUser;
  }

  static async getShopStaff(ownerId: number, shopId: number) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop || shop.ownerId !== ownerId) {
      throw new Error('Shop not found or access denied.');
    }

    const staffList = await prisma.user.findMany({
      where: { shopId: shopId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return staffList;
  }

  static async deleteStaffUser(ownerId: number, shopId: number, staffId: number) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop || shop.ownerId !== ownerId) {
      throw new Error('Shop not found or access denied.');
    }

    const staffUser = await prisma.user.findUnique({ where: { id: staffId } });
    if (!staffUser || staffUser.shopId !== shopId) {
      throw new Error('Staff user not found in this shop.');
    }

    await prisma.user.delete({ where: { id: staffId } });

    return { message: 'Staff user deleted successfully.' };
  }
}
