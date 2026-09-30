import { prisma } from '../config/prisma';
import { PackageType, SubscriptionStatus, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const PRICING_PACKAGES = [
  {
    type: 'ONE_MONTH',
    name: '1 Month Standard Package',
    durationDays: 30,
    price: 600.0,
    savings: '$0',
    description: 'Full multi-store POS, real-time inventory alerts, staff access & monthly reporting for 1 store.',
  },
  {
    type: 'THREE_MONTHS',
    name: '3 Months Value Package',
    durationDays: 90,
    price: 1500.0,
    savings: 'Save $300',
    description: 'Discounted quarterly package with priority support and unlimited staff seats.',
  },
  {
    type: 'SIX_MONTHS',
    name: '6 Months Growth Package',
    durationDays: 180,
    price: 2800.0,
    savings: 'Save $800',
    description: 'Semi-annual package designed for expanding retail businesses.',
  },
  {
    type: 'ONE_YEAR',
    name: '12 Months Enterprise Package',
    durationDays: 365,
    price: 5000.0,
    savings: 'Save $2,200',
    description: 'Best value annual commitment with full executive portfolio analytics and inter-store transfers.',
  },
];

export const PAYMENT_BANK_DETAILS = {
  bankName: 'Global SaaS Commercial Bank',
  accountName: 'MyShop Platform Technologies LLC',
  accountNumber: '9920-4820-1102-8841',
  swiftCode: 'GSAASUS33',
  mobileMoneyNumber: '+1 (800) 555-MYSHOP',
  instructions: 'Please transfer the exact package amount to the account above and upload a clear screenshot / receipt photo of your confirmation receipt for Super Admin verification.',
};

export class SubscriptionService {
  static getPackages() {
    return {
      packages: PRICING_PACKAGES,
      bankDetails: PAYMENT_BANK_DETAILS,
    };
  }

  static async registerOwnerWithShop(dto: {
    email: string;
    password: string;
    name: string;
    shopName: string;
    address?: string;
    phone?: string;
    currency?: string;
    packageType: PackageType;
    paymentProofUrl: string;
  }) {
    const existingUser = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      throw new Error('Email is already registered. Please sign in or use a different email.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const packageConfig = PRICING_PACKAGES.find((p) => p.type === dto.packageType) || PRICING_PACKAGES[0];

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Owner User
      const owner = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          name: dto.name,
          role: Role.OWNER,
        },
      });

      // 2. Create Initial Shop Location
      const shop = await tx.shop.create({
        data: {
          name: dto.shopName,
          address: dto.address || undefined,
          phone: dto.phone || undefined,
          currency: dto.currency || 'USD',
          ownerId: owner.id,
        },
      });

      // 3. Create Subscription Record pending Super Admin Approval
      const subscription = await tx.shopSubscription.create({
        data: {
          shopId: shop.id,
          ownerId: owner.id,
          packageType: dto.packageType,
          amount: packageConfig.price,
          paymentProofUrl: dto.paymentProofUrl,
          status: SubscriptionStatus.PENDING_APPROVAL,
          adminNotes: 'New store subscription created. Awaiting payment receipt verification by Super Admin.',
        },
      });

      // 4. Record initial payment receipt log
      await tx.subscriptionPayment.create({
        data: {
          subscriptionId: subscription.id,
          packageType: dto.packageType,
          amount: packageConfig.price,
          paymentProofUrl: dto.paymentProofUrl,
          status: SubscriptionStatus.PENDING_APPROVAL,
        },
      });

      // 5. Alert notification
      await tx.alert.create({
        data: {
          shopId: shop.id,
          type: 'SUBSCRIPTION_WARNING',
          severity: 'INFO',
          title: 'Subscription Registration Pending Approval',
          message: `Your payment proof for ${dto.shopName} (${packageConfig.name}) has been submitted to Super Admin. Operations will be activated upon verification.`,
        },
      });

      return { owner, shop, subscription };
    });

    return result;
  }

  static async submitRenewalPayment(dto: {
    ownerId: number;
    shopId: number;
    packageType: PackageType;
    paymentProofUrl: string;
  }) {
    const shop = await prisma.shop.findUnique({
      where: { id: dto.shopId },
      include: { subscription: true },
    });

    if (!shop || shop.ownerId !== dto.ownerId) {
      throw new Error('Shop not found or access denied.');
    }

    const packageConfig = PRICING_PACKAGES.find((p) => p.type === dto.packageType) || PRICING_PACKAGES[0];

    const result = await prisma.$transaction(async (tx) => {
      let subscription = shop.subscription;

      if (!subscription) {
        subscription = await tx.shopSubscription.create({
          data: {
            shopId: dto.shopId,
            ownerId: dto.ownerId,
            packageType: dto.packageType,
            amount: packageConfig.price,
            paymentProofUrl: dto.paymentProofUrl,
            status: SubscriptionStatus.PENDING_APPROVAL,
          },
        });
      } else {
        subscription = await tx.shopSubscription.update({
          where: { id: subscription.id },
          data: {
            packageType: dto.packageType,
            amount: packageConfig.price,
            paymentProofUrl: dto.paymentProofUrl,
            status: SubscriptionStatus.PENDING_APPROVAL,
            adminNotes: 'Renewal payment proof submitted. Awaiting Super Admin review.',
          },
        });
      }

      await tx.subscriptionPayment.create({
        data: {
          subscriptionId: subscription.id,
          packageType: dto.packageType,
          amount: packageConfig.price,
          paymentProofUrl: dto.paymentProofUrl,
          status: SubscriptionStatus.PENDING_APPROVAL,
        },
      });

      await tx.alert.create({
        data: {
          shopId: dto.shopId,
          type: 'SUBSCRIPTION_WARNING',
          severity: 'INFO',
          title: 'Renewal Payment Submitted',
          message: `Renewal receipt for package ${packageConfig.name} submitted. Awaiting Admin approval.`,
        },
      });

      return subscription;
    });

    return result;
  }

  static async getPendingSubscriptions() {
    const subscriptions = await prisma.shopSubscription.findMany({
      where: { status: SubscriptionStatus.PENDING_APPROVAL },
      include: {
        shop: true,
        owner: {
          select: { id: true, name: true, email: true, createdAt: true },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return subscriptions;
  }

  static async approveSubscription(subscriptionId: number, adminUserId: number, adminNotes?: string) {
    const subscription = await prisma.shopSubscription.findUnique({
      where: { id: subscriptionId },
      include: { shop: true, owner: true },
    });

    if (!subscription) {
      throw new Error('Subscription record not found.');
    }

    const packageConfig = PRICING_PACKAGES.find((p) => p.type === subscription.packageType) || PRICING_PACKAGES[0];
    const durationDays = packageConfig.durationDays;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + durationDays);

    const result = await prisma.$transaction(async (tx) => {
      const updatedSub = await tx.shopSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          startDate,
          endDate,
          adminNotes: adminNotes || 'Approved & activated by Super Admin.',
        },
      });

      await tx.subscriptionPayment.updateMany({
        where: { subscriptionId, status: SubscriptionStatus.PENDING_APPROVAL },
        data: {
          status: SubscriptionStatus.ACTIVE,
          reviewedBy: adminUserId,
          adminNotes: adminNotes || 'Approved by Super Admin.',
        },
      });

      await tx.alert.create({
        data: {
          shopId: subscription.shopId,
          type: 'SUBSCRIPTION_WARNING',
          severity: 'INFO',
          title: 'Subscription Activated! 🎉',
          message: `Your ${packageConfig.name} for ${subscription.shop.name} is now ACTIVE until ${endDate.toLocaleDateString()}. Full store features enabled.`,
        },
      });

      return updatedSub;
    });

    return result;
  }

  static async rejectSubscription(subscriptionId: number, adminUserId: number, reason: string) {
    const subscription = await prisma.shopSubscription.findUnique({
      where: { id: subscriptionId },
      include: { shop: true },
    });

    if (!subscription) {
      throw new Error('Subscription record not found.');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedSub = await tx.shopSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.REJECTED,
          adminNotes: reason,
        },
      });

      await tx.subscriptionPayment.updateMany({
        where: { subscriptionId, status: SubscriptionStatus.PENDING_APPROVAL },
        data: {
          status: SubscriptionStatus.REJECTED,
          reviewedBy: adminUserId,
          adminNotes: reason,
        },
      });

      await tx.alert.create({
        data: {
          shopId: subscription.shopId,
          type: 'SUBSCRIPTION_WARNING',
          severity: 'CRITICAL',
          title: 'Payment Verification Rejected ❌',
          message: `Your subscription payment receipt for ${subscription.shop.name} was rejected: "${reason}". Please upload a valid payment proof.`,
        },
      });

      return updatedSub;
    });

    return result;
  }

  static async getShopSubscriptionDetails(shopId: number) {
    const subscription = await prisma.shopSubscription.findUnique({
      where: { shopId },
      include: {
        shop: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!subscription) {
      return {
        hasSubscription: false,
        status: 'NONE',
        daysRemaining: 0,
        isWarning: false,
        isExpired: true,
      };
    }

    const now = new Date();
    const endDate = subscription.endDate ? new Date(subscription.endDate) : null;
    let daysRemaining = 0;

    if (endDate && subscription.status === SubscriptionStatus.ACTIVE) {
      const diffTime = endDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    const isExpired =
      subscription.status === SubscriptionStatus.EXPIRED ||
      (subscription.status === SubscriptionStatus.ACTIVE && daysRemaining <= 0);
    const isWarning = subscription.status === SubscriptionStatus.ACTIVE && daysRemaining > 0 && daysRemaining <= 5;

    return {
      hasSubscription: true,
      subscription,
      daysRemaining: Math.max(0, daysRemaining),
      isWarning,
      isExpired,
      status: isExpired ? 'EXPIRED' : subscription.status,
    };
  }

  static async getAdminOverview() {
    const [
      totalUsers,
      totalOwners,
      totalShops,
      activeSubscriptions,
      pendingSubscriptions,
      totalPayments,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: Role.OWNER } }),
      prisma.shop.count(),
      prisma.shopSubscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      prisma.shopSubscription.count({ where: { status: SubscriptionStatus.PENDING_APPROVAL } }),
      prisma.subscriptionPayment.aggregate({
        _sum: { amount: true },
        where: { status: SubscriptionStatus.ACTIVE },
      }),
    ]);

    const allSubscriptions = await prisma.shopSubscription.findMany({
      include: {
        shop: true,
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      metrics: {
        totalUsers,
        totalOwners,
        totalShops,
        activeSubscriptions,
        pendingSubscriptions,
        totalRevenue: totalPayments._sum.amount ? Number(totalPayments._sum.amount) : 0,
      },
      subscriptions: allSubscriptions,
    };
  }
}
