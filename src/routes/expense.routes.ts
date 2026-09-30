import { Router } from 'express';
import { ExpenseController } from '../controllers/expense.controller';
import { authenticateToken, checkShopAccess } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.post('/shop/:shopId', checkShopAccess, ExpenseController.createExpense);
router.get('/shop/:shopId', checkShopAccess, ExpenseController.getExpenses);
router.delete('/:expenseId/shop/:shopId', checkShopAccess, ExpenseController.deleteExpense);

export default router;
