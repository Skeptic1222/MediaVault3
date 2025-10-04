import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface UserClaims {
  sub: string;
  email: string;
  role?: string;
  permissions?: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: {
    claims: UserClaims;
  };
}

// Role hierarchy
export enum Role {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest',
}

// Permission definitions
export enum Permission {
  // User permissions
  READ_OWN_FILES = 'read:own_files',
  WRITE_OWN_FILES = 'write:own_files',
  DELETE_OWN_FILES = 'delete:own_files',
  SHARE_OWN_FILES = 'share:own_files',

  // Admin permissions
  READ_ALL_FILES = 'read:all_files',
  DELETE_ALL_FILES = 'delete:all_files',
  MANAGE_USERS = 'manage:users',
  VIEW_ADMIN_PANEL = 'view:admin_panel',
  MANAGE_SETTINGS = 'manage:settings',
  VIEW_AUDIT_LOGS = 'view:audit_logs',
}

// Role-permission mapping
const rolePermissions: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    Permission.READ_OWN_FILES,
    Permission.WRITE_OWN_FILES,
    Permission.DELETE_OWN_FILES,
    Permission.SHARE_OWN_FILES,
    Permission.READ_ALL_FILES,
    Permission.DELETE_ALL_FILES,
    Permission.MANAGE_USERS,
    Permission.VIEW_ADMIN_PANEL,
    Permission.MANAGE_SETTINGS,
    Permission.VIEW_AUDIT_LOGS,
  ],
  [Role.USER]: [
    Permission.READ_OWN_FILES,
    Permission.WRITE_OWN_FILES,
    Permission.DELETE_OWN_FILES,
    Permission.SHARE_OWN_FILES,
  ],
  [Role.GUEST]: [
    Permission.READ_OWN_FILES,
  ],
};

/**
 * Get permissions for a given role
 */
export function getRolePermissions(role: Role): Permission[] {
  return rolePermissions[role] || [];
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(user: UserClaims | undefined, permission: Permission): boolean {
  if (!user) return false;

  const userRole = (user.role as Role) || Role.GUEST;
  const permissions = getRolePermissions(userRole);

  // Check explicit permissions
  if (user.permissions?.includes(permission)) return true;

  // Check role-based permissions
  return permissions.includes(permission);
}

/**
 * Check if a user has a specific role or higher
 */
export function hasRole(user: UserClaims | undefined, role: Role): boolean {
  if (!user) return false;

  const userRole = (user.role as Role) || Role.GUEST;

  // Admin has all roles
  if (userRole === Role.ADMIN) return true;

  // User has user and guest roles
  if (userRole === Role.USER && (role === Role.USER || role === Role.GUEST)) return true;

  // Exact match
  return userRole === role;
}

/**
 * Middleware: Require specific role
 */
export function requireRole(role: Role) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user?.claims;

    if (!hasRole(user, role)) {
      logger.warn('Access denied - insufficient role', {
        userId: user?.sub,
        requiredRole: role,
        userRole: user?.role,
        path: req.path,
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: `${role} role required`,
      });
    }

    next();
  };
}

/**
 * Middleware: Require specific permission
 */
export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user?.claims;

    if (!hasPermission(user, permission)) {
      logger.warn('Access denied - insufficient permissions', {
        userId: user?.sub,
        requiredPermission: permission,
        userPermissions: user?.permissions,
        path: req.path,
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
    }

    next();
  };
}

/**
 * Middleware: Require admin role
 */
export const requireAdmin = requireRole(Role.ADMIN);

/**
 * Middleware: Check if user owns the resource
 */
export function requireOwnership(getUserIdFromRequest: (req: AuthenticatedRequest) => string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user?.claims;
    const resourceUserId = getUserIdFromRequest(req);

    // Admins can access any resource
    if (hasRole(user, Role.ADMIN)) {
      return next();
    }

    // Users can only access their own resources
    if (user?.sub !== resourceUserId) {
      logger.warn('Access denied - not resource owner', {
        userId: user?.sub,
        resourceUserId,
        path: req.path,
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own resources',
      });
    }

    next();
  };
}
