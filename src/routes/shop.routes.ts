import { Router } from 'express';
import { ShopController } from '../controllers/shop.controller';
import { authenticateToken, checkShopAccess, requireRoles } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticateToken);

// Multi-Shop Owner Routes
router.get('/owner/dashboard', requireRoles([Role.OWNER]), ShopController.getOwnerAggregatedDashboard);
router.post('/owner/transfer-stock', requireRoles([Role.OWNER]), ShopController.transferStock);

// Standard Shop Routes
router.post('/', requireRoles([Role.OWNER]), ShopController.createShop);
router.get('/my-shops', ShopController.getMyShops);
router.get('/:shopId', checkShopAccess, ShopController.getShopById);
router.put('/:shopId', checkShopAccess, ShopController.updateShop);
router.delete('/:shopId', checkShopAccess, ShopController.deleteShop);

export default router;
