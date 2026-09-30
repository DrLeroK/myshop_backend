import { Router } from 'express';
import authRoutes from './auth.routes';
import shopRoutes from './shop.routes';
import categoryRoutes from './category.routes';
import productRoutes from './product.routes';
import saleRoutes from './sale.routes';
import expenseRoutes from './expense.routes';
import financialRoutes from './financial.routes';
import alertRoutes from './alert.routes';
import subscriptionRoutes from './subscription.routes';
import adminRoutes from './admin.routes';
import staffRoutes from './staff.routes';
import loanRoutes from './loan.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/shops', shopRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/sales', saleRoutes);
router.use('/expenses', expenseRoutes);
router.use('/reports', financialRoutes);
router.use('/alerts', alertRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/admin', adminRoutes);
router.use('/staff', staffRoutes);
router.use('/loans', loanRoutes);

export default router;
