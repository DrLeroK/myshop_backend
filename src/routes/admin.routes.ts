import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Protect all admin routes for SUPER_ADMIN role only
router.use(authenticateToken);
router.use(requireRoles([Role.SUPER_ADMIN]));

router.get('/pending-subscriptions', AdminController.getPendingSubscriptions);
router.post('/subscriptions/:subscriptionId/approve', AdminController.approveSubscription);
router.post('/subscriptions/:subscriptionId/reject', AdminController.rejectSubscription);
router.get('/overview', AdminController.getAdminOverview);

export default router;
