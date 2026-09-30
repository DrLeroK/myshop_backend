import { Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class AuthController {
  static async register(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, email, password, role } = req.body;
      const result = await AuthService.register({ name, email, password, role });
      res.status(201).json({
        success: true,
        message: 'User registered successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login({ email, password });
      res.status(200).json({
        success: true,
        message: 'Login successful.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.getProfile(req.user!.userId);
      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
}
