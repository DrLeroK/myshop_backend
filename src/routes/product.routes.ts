import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { authenticateToken, checkShopAccess, checkSubscriptionActive } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.post('/shop/:shopId', checkShopAccess, checkSubscriptionActive, ProductController.createProduct);
router.get('/shop/:shopId', checkShopAccess, ProductController.getProducts);
router.get('/:productId/shop/:shopId', checkShopAccess, ProductController.getProductById);
router.put('/:productId/shop/:shopId', checkShopAccess, checkSubscriptionActive, ProductController.updateProduct);
router.patch('/:productId/stock/shop/:shopId', checkShopAccess, checkSubscriptionActive, ProductController.adjustStock);
router.delete('/:productId/shop/:shopId', checkShopAccess, checkSubscriptionActive, ProductController.deleteProduct);

export default router;
