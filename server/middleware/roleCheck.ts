// FILE: server/middleware/roleCheck.ts
import type { RequestHandler } from 'express';

export const requireAdmin: RequestHandler = (req: any, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if ((req.user.role || 'user') !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
  return next();
};

export const requireRole = (roles: string[]): RequestHandler => {
  return (req: any, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!roles.includes(req.user.role || '')) {
      return res.status(403).json({ message: `Forbidden: Requires one of: ${roles.join(', ')}` });
    }
    return next();
  };
};
