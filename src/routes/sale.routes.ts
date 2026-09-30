import { Router } from 'express';
import { SaleController } from '../controllers/sale.controller';
import { authenticateToken, checkShopAccess, checkSubscriptionActive } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.post('/shop/:shopId', checkShopAccess, checkSubscriptionActive, SaleController.logSale);
router.get('/shop/:shopId', checkShopAccess, SaleController.getSalesHistory);
router.get('/:saleId/shop/:shopId', checkShopAccess, SaleController.getSaleById);

export default router;
