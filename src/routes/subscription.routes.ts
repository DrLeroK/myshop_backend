import { Router } from 'express';
import { SubscriptionController } from '../controllers/subscription.controller';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public route: Pricing packages & bank details
router.get('/packages', SubscriptionController.getPackages);

// Public route: Register Owner + Store + Submit Payment Receipt Proof
router.post('/register-shop', SubscriptionController.registerOwnerWithShop);

// Protected routes (Requires Auth)
router.use(authenticateToken);

// Owner route: Submit subscription renewal payment receipt
router.post('/renew', requireRoles([Role.OWNER]), SubscriptionController.submitRenewalPayment);

// View subscription status for a shop
router.get('/shop/:shopId', SubscriptionController.getShopSubscription);

export default router;
