import { Router } from 'express';
import { AlertController } from '../controllers/alert.controller';
import { authenticateToken, checkShopAccess } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/shop/:shopId', checkShopAccess, AlertController.getAlerts);
router.patch('/:alertId/read/shop/:shopId', checkShopAccess, AlertController.markAsRead);
router.post('/read-all/shop/:shopId', checkShopAccess, AlertController.markAllAsRead);
router.post('/check-low-sales/shop/:shopId', checkShopAccess, AlertController.triggerLowSalesCheck);

export default router;
