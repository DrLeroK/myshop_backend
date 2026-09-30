import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { ENV } from '../config/env';
import { AppError } from '../middlewares/error.middleware';
import { Role } from '@prisma/client';

export class AuthService {
  static async register(data: { name: string; email: string; password: string; role?: Role }) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new AppError('User with this email already exists.', 400);
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        password: hashedPassword,
        role: data.role || Role.OWNER,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      ENV.JWT_SECRET as jwt.Secret,
      { expiresIn: '7d' }
    );

    return { user, token };
  }

  static async login(data: { email: string; password: string }) {
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      include: {
        ownedShops: {
          select: { id: true, name: true, currency: true },
        },
        assignedShop: {
          select: { id: true, name: true, currency: true },
        },
      },
    });

    if (!user) {
      throw new AppError('Invalid email or password.', 401);
    }

    const isMatch = await bcrypt.compare(data.password, user.password);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401);
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      ENV.JWT_SECRET as jwt.Secret,
      { expiresIn: '7d' }
    );

    const { password, ...userWithoutPassword } = user;

    // Combine shops list for owner vs staff
    let shopsList = user.ownedShops || [];
    if (user.assignedShop && shopsList.length === 0) {
      shopsList = [user.assignedShop as any];
    }

    return {
      user: {
        ...userWithoutPassword,
        shops: shopsList,
      },
      token,
    };
  }

  static async getProfile(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        ownedShops: {
          select: { id: true, name: true, currency: true, address: true, phone: true },
        },
        assignedShop: {
          select: { id: true, name: true, currency: true, address: true, phone: true },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    let shopsList = user.ownedShops || [];
    if (user.assignedShop && shopsList.length === 0) {
      shopsList = [user.assignedShop as any];
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      shops: shopsList,
    };
  }
}
