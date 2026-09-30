import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller';
import { authenticateToken, checkShopAccess, checkSubscriptionActive } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.post('/shop/:shopId', checkShopAccess, checkSubscriptionActive, CategoryController.createCategory);
router.get('/shop/:shopId', checkShopAccess, CategoryController.getCategories);
router.put('/:categoryId', checkSubscriptionActive, CategoryController.updateCategory);
router.delete('/:categoryId', checkSubscriptionActive, CategoryController.deleteCategory);

export default router;
