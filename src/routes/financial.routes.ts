import { Router } from 'express';
import { FinancialController } from '../controllers/financial.controller';
import { authenticateToken, checkShopAccess } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/summary/shop/:shopId', checkShopAccess, FinancialController.getFinancialSummary);
router.get('/best-sellers/shop/:shopId', checkShopAccess, FinancialController.getBestSellingProducts);
router.get('/trends/shop/:shopId', checkShopAccess, FinancialController.getTrendComparison);
router.get('/payment-methods/shop/:shopId', checkShopAccess, FinancialController.getPaymentMethodBreakdown);

export default router;
