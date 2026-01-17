import { supabase } from '@/integrations/supabase/client';

/**
 * Audit Log Types
 */
export type ActionType =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'FAILED_LOGIN'
  | 'PERMISSION_DENIED';

export type ResourceType =
  | 'USER'
  | 'PROPERTY'
  | 'APPOINTMENT'
  | 'PROFILE'
  | 'ADMIN'
  | 'TENANT'
  | 'OWNER'
  | 'AUTH';

export type Status = 'SUCCESS' | 'FAILED' | 'DENIED';

export type Severity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface AuditLogEntry {
  user_id?: string;
  action_type: ActionType;
  resource_type: ResourceType;
  resource_id?: string;
  description: string;
  ip_address?: string;
  user_agent?: string;
  status?: Status;
  severity?: Severity;
  metadata?: Record<string, any>;
}

/**
 * Logs an audit event to the database
 */
export const logAuditEvent = async (entry: AuditLogEntry): Promise<void> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('audit_log').insert({
      user_id: entry.user_id || user?.id || null,
      user_email: user?.email || null,
      action_type: entry.action_type,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id,
      description: entry.description,
      ip_address: entry.ip_address,
      user_agent: entry.user_agent || navigator.userAgent,
      status: entry.status || 'SUCCESS',
      severity: entry.severity || 'INFO',
      metadata: entry.metadata || null,
    });

    if (error) {
      console.error('Failed to log audit event:', error);
    }
  } catch (error) {
    console.error('Error in logAuditEvent:', error);
  }
};

/**
 * Logs successful login
 */
export const logLogin = async (userId: string): Promise<void> => {
  await logAuditEvent({
    user_id: userId,
    action_type: 'LOGIN',
    resource_type: 'AUTH',
    description: 'User logged in successfully',
    severity: 'INFO',
  });
};

/**
 * Logs failed login attempt
 */
export const logFailedLogin = async (email: string, reason: string): Promise<void> => {
  await logAuditEvent({
    action_type: 'FAILED_LOGIN',
    resource_type: 'AUTH',
    description: `Failed login attempt for ${email}: ${reason}`,
    severity: 'WARNING',
    metadata: { email, reason },
  });
};

/**
 * Logs logout
 */
export const logLogout = async (userId: string): Promise<void> => {
  await logAuditEvent({
    user_id: userId,
    action_type: 'LOGOUT',
    resource_type: 'AUTH',
    description: 'User logged out',
    severity: 'INFO',
  });
};

/**
 * Logs permission denied access
 */
export const logPermissionDenied = async (
  resourceType: ResourceType,
  resourceId: string,
  reason: string
): Promise<void> => {
  await logAuditEvent({
    action_type: 'PERMISSION_DENIED',
    resource_type: resourceType,
    resource_id: resourceId,
    description: `Permission denied: ${reason}`,
    severity: 'ERROR',
    metadata: { reason },
  });
};

/**
 * Logs sensitive data access (decryption of IC, contact number, etc.)
 */
export const logSensitiveDataAccess = async (
  resourceType: ResourceType,
  resourceId: string,
  fieldsAccessed: string[]
): Promise<void> => {
  await logAuditEvent({
    action_type: 'READ',
    resource_type: resourceType,
    resource_id: resourceId,
    description: `Accessed sensitive fields: ${fieldsAccessed.join(', ')}`,
    severity: 'INFO',
    metadata: { fields_accessed: fieldsAccessed },
  });
};

/**
 * Logs profile update
 */
export const logProfileUpdate = async (
  resourceType: ResourceType,
  resourceId: string,
  updatedFields: string[]
): Promise<void> => {
  await logAuditEvent({
    action_type: 'UPDATE',
    resource_type: resourceType,
    resource_id: resourceId,
    description: `Profile updated: ${updatedFields.join(', ')}`,
    severity: 'INFO',
    metadata: { updated_fields: updatedFields },
  });
};

/**
 * Logs user creation by admin
 */
export const logUserCreation = async (
  resourceType: ResourceType,
  resourceId: string,
  userEmail: string
): Promise<void> => {
  await logAuditEvent({
    action_type: 'CREATE',
    resource_type: resourceType,
    resource_id: resourceId,
    description: `New user created: ${userEmail}`,
    severity: 'INFO',
    metadata: { user_email: userEmail },
  });
};

/**
 * Logs user deletion by admin
 */
export const logUserDeletion = async (
  resourceType: ResourceType,
  resourceId: string,
  userEmail: string
): Promise<void> => {
  await logAuditEvent({
    action_type: 'DELETE',
    resource_type: resourceType,
    resource_id: resourceId,
    description: `User deleted: ${userEmail}`,
    severity: 'WARNING',
    metadata: { user_email: userEmail },
  });
};

/**
 * Logs appointment creation
 */
export const logAppointmentCreation = async (
  appointmentId: string,
  propertyId: string
): Promise<void> => {
  await logAuditEvent({
    action_type: 'CREATE',
    resource_type: 'APPOINTMENT',
    resource_id: appointmentId,
    description: `Appointment created for property ${propertyId}`,
    severity: 'INFO',
    metadata: { property_id: propertyId },
  });
};

/**
 * Logs appointment status change
 */
export const logAppointmentStatusChange = async (
  appointmentId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> => {
  await logAuditEvent({
    action_type: 'UPDATE',
    resource_type: 'APPOINTMENT',
    resource_id: appointmentId,
    description: `Appointment status changed from ${oldStatus} to ${newStatus}`,
    severity: 'INFO',
    metadata: { old_status: oldStatus, new_status: newStatus },
  });
};

/**
 * Logs property creation
 */
export const logPropertyCreation = async (
  propertyId: string,
  propertyTitle: string
): Promise<void> => {
  await logAuditEvent({
    action_type: 'CREATE',
    resource_type: 'PROPERTY',
    resource_id: propertyId,
    description: `Property created: ${propertyTitle}`,
    severity: 'INFO',
    metadata: { property_title: propertyTitle },
  });
};

/**
 * Logs property update
 */
export const logPropertyUpdate = async (
  propertyId: string,
  updatedFields: string[]
): Promise<void> => {
  await logAuditEvent({
    action_type: 'UPDATE',
    resource_type: 'PROPERTY',
    resource_id: propertyId,
    description: `Property updated: ${updatedFields.join(', ')}`,
    severity: 'INFO',
    metadata: { updated_fields: updatedFields },
  });
};

/**
 * Logs property deletion
 */
export const logPropertyDeletion = async (
  propertyId: string,
  propertyTitle: string
): Promise<void> => {
  await logAuditEvent({
    action_type: 'DELETE',
    resource_type: 'PROPERTY',
    resource_id: propertyId,
    description: `Property deleted: ${propertyTitle}`,
    severity: 'WARNING',
    metadata: { property_title: propertyTitle },
  });
};

/**
 * Logs critical security event
 */
export const logSecurityEvent = async (
  description: string,
  metadata?: Record<string, any>
): Promise<void> => {
  await logAuditEvent({
    action_type: 'PERMISSION_DENIED',
    resource_type: 'AUTH',
    description,
    severity: 'CRITICAL',
    metadata,
  });
};

/**
 * Fetches audit logs (admin only)
 */
export const fetchAuditLogs = async (filters?: {
  userId?: string;
  actionType?: ActionType;
  resourceType?: ResourceType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) => {
  try {
    let query = supabase
      .from('audit_log')
      .select('*')
      .order('timestamp', { ascending: false });

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters?.actionType) {
      query = query.eq('action_type', filters.actionType);
    }
    if (filters?.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }
    if (filters?.startDate) {
      query = query.gte('timestamp', filters.startDate.toISOString());
    }
    if (filters?.endDate) {
      query = query.lte('timestamp', filters.endDate.toISOString());
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
};

/**
 * Fetches audit log summary (admin only)
 */
export const fetchAuditLogSummary = async () => {
  try {
    const { data, error } = await supabase
      .from('audit_log_summary')
      .select('*')
      .order('log_date', { ascending: false })
      .limit(30);

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching audit log summary:', error);
    return [];
  }
};
