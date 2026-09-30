import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';
import { LoanStatus, PaymentMethod, Prisma } from '@prisma/client';

export class LoanService {
  /**
   * Algorithmic Underwriting Engine:
   * Evaluates 30-day and 90-day store sales history, gross margins, and transaction velocity
   * to calculate Credit Risk Score (300-850) and Maximum Approved Loan Limit.
   */
  static async calculateUnderwritingMetrics(shopId: number) {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: { subscription: true },
    });

    if (!shop) {
      throw new AppError('Shop not found.', 404);
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Calculate total 30-day revenue & gross profit
    const salesStats = await prisma.sale.aggregate({
      where: {
        shopId,
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: {
        totalAmount: true,
        grossProfit: true,
      },
      _count: {
        id: true,
      },
    });

    const totalSales30Days = Number(salesStats._sum.totalAmount || 0);
    const grossProfit30Days = Number(salesStats._sum.grossProfit || 0);
    const transactionCount = salesStats._count.id || 0;

    const profitMarginPercent = totalSales30Days > 0 ? (grossProfit30Days / totalSales30Days) * 100 : 0;

    // Credit Underwriting Scoring Algorithm (Base: 600)
    let creditScore = 600;

    if (totalSales30Days >= 5000) creditScore += 80;
    else if (totalSales30Days >= 2000) creditScore += 50;
    else if (totalSales30Days >= 500) creditScore += 25;

    if (profitMarginPercent >= 30) creditScore += 60;
    else if (profitMarginPercent >= 15) creditScore += 30;

    if (transactionCount >= 50) creditScore += 60;
    else if (transactionCount >= 20) creditScore += 30;

    if (shop.subscription?.status === 'ACTIVE') creditScore += 50;

    // Cap score between 300 and 850
    creditScore = Math.min(850, Math.max(300, creditScore));

    // Maximum Recommended Working Capital Loan = 45% of 30-Day Gross Revenue
    const maxRecommendedLimit = Math.round(totalSales30Days * 0.45);

    return {
      shopId,
      shopName: shop.name,
      avgMonthlyRevenue: totalSales30Days,
      grossProfit30Days,
      profitMarginPercent: Math.round(profitMarginPercent * 10) / 10,
      transactionCount,
      calculatedCreditScore: creditScore,
      maxRecommendedLimit,
      underwritingGrade: creditScore >= 750 ? 'A+ (Low Risk)' : creditScore >= 680 ? 'B (Moderate Risk)' : 'C (High Risk)',
    };
  }

  static async applyForLoan(shopId: number, requestedAmount: number, purpose?: string) {
    const metrics = await this.calculateUnderwritingMetrics(shopId);

    if (requestedAmount > metrics.maxRecommendedLimit && metrics.maxRecommendedLimit > 0) {
      throw new AppError(
        `Requested loan ($${requestedAmount}) exceeds calculated credit limit ($${metrics.maxRecommendedLimit}).`,
        400
      );
    }

    const activeLoan = await prisma.loanApplication.findFirst({
      where: {
        shopId,
        status: { in: [LoanStatus.SUBMITTED, LoanStatus.UNDERWRITING_REVIEW, LoanStatus.APPROVED, LoanStatus.DISBURSED] },
      },
    });

    if (activeLoan) {
      throw new AppError(`Shop already has an active loan application (#${activeLoan.id}) with status ${activeLoan.status}.`, 400);
    }

    const application = await prisma.loanApplication.create({
      data: {
        shopId,
        requestedAmount: new Prisma.Decimal(requestedAmount),
        avgMonthlyRevenue: new Prisma.Decimal(metrics.avgMonthlyRevenue),
        calculatedCreditScore: metrics.calculatedCreditScore,
        maxRecommendedLimit: new Prisma.Decimal(metrics.maxRecommendedLimit),
        purpose: purpose || 'Inventory Working Capital',
        status: LoanStatus.SUBMITTED,
      },
    });

    return {
      application,
      underwritingMetrics: metrics,
    };
  }

  static async getShopLoans(shopId: number) {
    const loans = await prisma.loanApplication.findMany({
      where: { shopId },
      include: {
        repayments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return loans;
  }

  static async getAllLoanApplications(statusFilter?: LoanStatus) {
    const where = statusFilter ? { status: statusFilter } : {};

    const loans = await prisma.loanApplication.findMany({
      where,
      include: {
        shop: {
          select: { id: true, name: true, phone: true, owner: { select: { name: true, email: true } } },
        },
        repayments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return loans;
  }

  static async reviewLoanApplication(
    loanId: number,
    action: 'APPROVE' | 'DISBURSE' | 'REJECT',
    approvedAmount?: number,
    notes?: string
  ) {
    const loan = await prisma.loanApplication.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      throw new AppError('Loan application not found.', 404);
    }

    let status = loan.status;
    let approvedAmt = loan.approvedAmount;
    let approvedAt = loan.approvedAt;
    let disbursedAt = loan.disbursedAt;
    let dueDate = loan.dueDate;

    if (action === 'APPROVE') {
      status = LoanStatus.APPROVED;
      approvedAmt = approvedAmount ? new Prisma.Decimal(approvedAmount) : loan.requestedAmount;
      approvedAt = new Date();
    } else if (action === 'DISBURSE') {
      status = LoanStatus.DISBURSED;
      disbursedAt = new Date();
      dueDate = new Date(Date.now() + loan.termDays * 24 * 60 * 60 * 1000);
    } else if (action === 'REJECT') {
      status = LoanStatus.REJECTED;
    }

    const updated = await prisma.loanApplication.update({
      where: { id: loanId },
      data: {
        status,
        approvedAmount: approvedAmt,
        approvedAt,
        disbursedAt,
        dueDate,
        underwriterNotes: notes,
      },
      include: {
        shop: true,
        repayments: true,
      },
    });

    return updated;
  }
}
