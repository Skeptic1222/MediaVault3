import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

export interface AuditLogEntry {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent?: string;
  status: 'success' | 'failure';
  metadata?: any;
  timestamp: Date;
}

// Security-relevant actions to audit
export enum AuditAction {
  // Authentication
  LOGIN = 'auth.login',
  LOGOUT = 'auth.logout',
  LOGIN_FAILED = 'auth.login_failed',
  TOKEN_REFRESH = 'auth.token_refresh',

  // File operations
  FILE_UPLOAD = 'file.upload',
  FILE_DOWNLOAD = 'file.download',
  FILE_DELETE = 'file.delete',
  FILE_SHARE = 'file.share',
  FILE_ENCRYPT = 'file.encrypt',
  FILE_DECRYPT = 'file.decrypt',

  // Admin operations
  USER_CREATE = 'admin.user_create',
  USER_DELETE = 'admin.user_delete',
  USER_UPDATE = 'admin.user_update',
  SETTINGS_CHANGE = 'admin.settings_change',

  // Security events
  ACCESS_DENIED = 'security.access_denied',
  INVALID_TOKEN = 'security.invalid_token',
  SUSPICIOUS_ACTIVITY = 'security.suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'security.rate_limit_exceeded',
}

/**
 * Create audit log table if it doesn't exist
 */
export async function ensureAuditLogTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255),
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        status VARCHAR(20) NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_user_id (user_id),
        INDEX idx_audit_action (action),
        INDEX idx_audit_created_at (created_at),
        INDEX idx_audit_status (status)
      )
    `);
    logger.info('Audit log table ensured');
  } catch (error) {
    logger.error('Failed to create audit log table', { error });
  }
}

/**
 * Log an audit entry
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO audit_logs (
        user_id, action, resource, resource_id,
        ip_address, user_agent, status, metadata, created_at
      ) VALUES (
        ${entry.userId || null},
        ${entry.action},
        ${entry.resource},
        ${entry.resourceId || null},
        ${entry.ipAddress},
        ${entry.userAgent || null},
        ${entry.status},
        ${entry.metadata ? JSON.stringify(entry.metadata) : null},
        ${entry.timestamp}
      )
    `);
  } catch (error) {
    // Don't fail the request if audit logging fails
    logger.error('Failed to write audit log', { error, entry });
  }
}

/**
 * Get IP address from request, considering proxies
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Middleware: Audit successful requests
 */
export function auditSuccess(action: AuditAction, getResourceId?: (req: Request) => string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user?.claims;
    const originalSend = res.send;

    res.send = function (data: any) {
      // Only log if response is successful (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logAudit({
          userId: user?.sub,
          action,
          resource: req.path,
          resourceId: getResourceId?.(req),
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
          status: 'success',
          metadata: {
            method: req.method,
            statusCode: res.statusCode,
          },
          timestamp: new Date(),
        });
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Middleware: Audit failed authentication attempts
 */
export function auditAuthFailure() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalStatus = res.status;

    res.status = function (statusCode: number) {
      if (statusCode === 401 || statusCode === 403) {
        logAudit({
          action: AuditAction.ACCESS_DENIED,
          resource: req.path,
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
          status: 'failure',
          metadata: {
            method: req.method,
            statusCode,
          },
          timestamp: new Date(),
        });
      }

      return originalStatus.call(this, statusCode);
    };

    next();
  };
}

/**
 * Query audit logs
 */
export async function queryAuditLogs(filters: {
  userId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  status?: 'success' | 'failure';
  limit?: number;
}) {
  const { userId, action, startDate, endDate, status, limit = 100 } = filters;

  let query = sql`SELECT * FROM audit_logs WHERE 1=1`;

  if (userId) {
    query = sql`${query} AND user_id = ${userId}`;
  }

  if (action) {
    query = sql`${query} AND action = ${action}`;
  }

  if (startDate) {
    query = sql`${query} AND created_at >= ${startDate}`;
  }

  if (endDate) {
    query = sql`${query} AND created_at <= ${endDate}`;
  }

  if (status) {
    query = sql`${query} AND status = ${status}`;
  }

  query = sql`${query} ORDER BY created_at DESC LIMIT ${limit}`;

  return await db.execute(query);
}
