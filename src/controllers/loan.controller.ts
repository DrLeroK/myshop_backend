import { Request, Response, NextFunction } from 'express';
import { LoanService } from '../services/loan.service';
import { LoanStatus } from '@prisma/client';

export class LoanController {
  static async getUnderwritingMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = Number(req.params.shopId);
      const metrics = await LoanService.calculateUnderwritingMetrics(shopId);
      res.status(200).json({ success: true, data: metrics });
    } catch (error) {
      next(error);
    }
  }

  static async applyForLoan(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = Number(req.params.shopId);
      const { requestedAmount, purpose } = req.body;
      const result = await LoanService.applyForLoan(shopId, Number(requestedAmount), purpose);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getShopLoans(req: Request, res: Response, next: NextFunction) {
    try {
      const shopId = Number(req.params.shopId);
      const loans = await LoanService.getShopLoans(shopId);
      res.status(200).json({ success: true, data: loans });
    } catch (error) {
      next(error);
    }
  }

  static async getAllLoanApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const statusFilter = req.query.status as LoanStatus | undefined;
      const loans = await LoanService.getAllLoanApplications(statusFilter);
      res.status(200).json({ success: true, data: loans });
    } catch (error) {
      next(error);
    }
  }

  static async reviewLoan(req: Request, res: Response, next: NextFunction) {
    try {
      const loanId = Number(req.params.id);
      const { action, approvedAmount, notes } = req.body;
      const updated = await LoanService.reviewLoanApplication(loanId, action, approvedAmount, notes);
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
}
