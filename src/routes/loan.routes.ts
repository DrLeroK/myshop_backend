import { Router } from 'express';
import { LoanController } from '../controllers/loan.controller';
import { authenticateToken, requireRoles, checkShopAccess } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Shop Owner Endpoints
// Note: These routes need shop access verification  
router.get(
  '/underwriting/:shopId',
  checkShopAccess,
  LoanController.getUnderwritingMetrics
);

router.post(
  '/apply/:shopId',
  checkShopAccess,
  requireRoles([Role.OWNER, Role.SUPER_ADMIN]),
  LoanController.applyForLoan
);

router.get(
  '/shop/:shopId',
  checkShopAccess,
  LoanController.getShopLoans
);

// Financial Institution / Super Admin Underwriter Endpoints
router.get(
  '/all',
  requireRoles([Role.SUPER_ADMIN]),
  LoanController.getAllLoanApplications
);

router.patch(
  '/review/:id',
  requireRoles([Role.SUPER_ADMIN]),
  LoanController.reviewLoan
);

export default router;
