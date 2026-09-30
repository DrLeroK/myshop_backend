import { Router } from 'express';
import { StaffController } from '../controllers/staff.controller';
import { authenticateToken, checkShopAccess, requireRoles } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticateToken);
router.use(requireRoles([Role.OWNER, Role.SUPER_ADMIN]));

router.post('/shop/:shopId', checkShopAccess, StaffController.createStaffUser);
router.get('/shop/:shopId', checkShopAccess, StaffController.getShopStaff);
router.delete('/:staffId/shop/:shopId', checkShopAccess, StaffController.deleteStaffUser);

export default router;
