import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { StaffService } from '../services/staff.service';

export class StaffController {
  static async createStaffUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = req.user!.userId;
      const shopId = parseInt(req.params.shopId, 10);
      const { email, password, name, role } = req.body;

      if (!email || !password || !name || !role) {
        res.status(400).json({ success: false, message: 'Email, password, name, and role are required.' });
        return;
      }

      const staff = await StaffService.createStaffUser(ownerId, shopId, { email, password, name, role });
      res.status(201).json({
        success: true,
        message: `Staff user (${role}) created successfully for shop.`,
        data: staff,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getShopStaff(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = req.user!.userId;
      const shopId = parseInt(req.params.shopId, 10);

      const staffList = await StaffService.getShopStaff(ownerId, shopId);
      res.status(200).json({ success: true, data: staffList });
    } catch (error) {
      next(error);
    }
  }

  static async deleteStaffUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = req.user!.userId;
      const shopId = parseInt(req.params.shopId, 10);
      const staffId = parseInt(req.params.staffId, 10);

      const result = await StaffService.deleteStaffUser(ownerId, shopId, staffId);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }
}
