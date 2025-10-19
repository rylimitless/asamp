import type { Payload } from 'payload'
import type { PayloadRequest } from 'payload'
import crypto from 'crypto'

interface AuditLogEntry {
  action: string
  operationType:
    | 'create'
    | 'update'
    | 'delete'
    | 'login'
    | 'logout'
    | 'checkin'
    | 'checkout'
    | 'approve'
    | 'reject'
  collection: string
  documentId?: string
  performedBy?: string
  ipAddress?: string
  userAgent?: string
  changes?: {
    before?: any
    after?: any
    fieldsChanged?: string[]
  }
  metadata?: {
    severity?: 'low' | 'medium' | 'high' | 'critical'
    category?: 'attendance' | 'leave' | 'user' | 'squad' | 'system' | 'security' | 'report'
    compliance?: boolean
  }
}

export async function createAuditLog(payload: Payload, entry: AuditLogEntry, req?: PayloadRequest) {
  try {
    // Extract request information if available
    const ipAddress = (req as any)?.ip || entry.ipAddress
    const userAgent = req?.headers?.get?.('user-agent') || entry.userAgent
    const performedBy = req?.user?.id || entry.performedBy

    // Calculate checksum for tamper-proof logging
    const dataForChecksum = {
      action: entry.action,
      operationType: entry.operationType,
      collection: entry.collection,
      documentId: entry.documentId,
      timestamp: new Date().toISOString(),
      changes: entry.changes,
    }
    const checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(dataForChecksum))
      .digest('hex')

    // Determine severity and category if not provided
    const severity =
      entry.metadata?.severity || determineSeverity(entry.operationType, entry.collection)
    const category = entry.metadata?.category || determineCategory(entry.collection)
    const compliance =
      entry.metadata?.compliance ??
      determineComplianceRelevance(entry.collection, entry.operationType)

    // Create the audit log entry (bypassing access controls)
    await payload.db.create({
      collection: 'auditLogs',
      data: {
        action: entry.action,
        operationType: entry.operationType,
        collection: entry.collection,
        documentId: entry.documentId,
        performedBy,
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString(),
        changes: entry.changes,
        metadata: {
          severity,
          category,
          compliance,
        },
        checksum,
      },
      req: req || { user: null }, // Use provided request or create minimal one
    })

    console.log(`Audit log created: ${entry.action}`)
  } catch (error) {
    console.error('Failed to create audit log:', error)
    // Don't throw error - audit logging should not break the main operation
  }
}

function determineSeverity(
  operationType: string,
  collection: string,
): 'low' | 'medium' | 'high' | 'critical' {
  // Critical operations
  if (operationType === 'delete' && ['users', 'auditLogs'].includes(collection)) {
    return 'critical'
  }

  // High severity operations
  if (
    operationType === 'delete' ||
    (collection === 'users' && operationType === 'update') ||
    (collection === 'attendanceLogs' && operationType === 'update')
  ) {
    return 'high'
  }

  // Medium severity operations
  if (
    ['create', 'update'].includes(operationType) &&
    ['squads', 'sprints', 'leaveRequests'].includes(collection)
  ) {
    return 'medium'
  }

  return 'low'
}

function determineCategory(
  collection: string,
): 'attendance' | 'leave' | 'user' | 'squad' | 'system' | 'security' | 'report' {
  switch (collection) {
    case 'attendanceLogs':
      return 'attendance'
    case 'leaveRequests':
      return 'leave'
    case 'users':
      return 'user'
    case 'squads':
      return 'squad'
    case 'reports':
      return 'report'
    case 'auditLogs':
      return 'security'
    default:
      return 'system'
  }
}

function determineComplianceRelevance(collection: string, operationType: string): boolean {
  // These collections/operations are always compliance-relevant
  const complianceCollections = ['attendanceLogs', 'leaveRequests', 'users', 'auditLogs']
  const complianceOperations = ['delete', 'update']

  return complianceCollections.includes(collection) || complianceOperations.includes(operationType)
}

export function compareObjects(before: any, after: any): string[] {
  const changedFields: string[] = []

  if (!before && !after) return changedFields
  if (!before) return Object.keys(after || {})
  if (!after) return Object.keys(before)

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const key of allKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changedFields.push(key)
    }
  }

  return changedFields
}

// Utility function to create attendance-specific audit logs
export async function logAttendanceAction(
  payload: Payload,
  action: 'checkin' | 'checkout',
  attendanceLogId: string,
  userId: string,
  req?: PayloadRequest,
) {
  await createAuditLog(
    payload,
    {
      action: `User ${action === 'checkin' ? 'checked in' : 'checked out'}`,
      operationType: action,
      collection: 'attendanceLogs',
      documentId: attendanceLogId,
      performedBy: userId,
      metadata: {
        severity: 'medium',
        category: 'attendance',
        compliance: true,
      },
    },
    req,
  )
}

// Utility function to create leave request audit logs
export async function logLeaveAction(
  payload: Payload,
  action: 'create' | 'update' | 'approve' | 'reject',
  leaveRequestId: string,
  userId: string,
  changes?: { before?: any; after?: any },
  req?: PayloadRequest,
) {
  const actionDescriptions = {
    create: 'Leave request submitted',
    update: 'Leave request updated',
    approve: 'Leave request approved',
    reject: 'Leave request rejected',
  }

  await createAuditLog(
    payload,
    {
      action: actionDescriptions[action],
      operationType: action,
      collection: 'leaveRequests',
      documentId: leaveRequestId,
      performedBy: userId,
      changes: changes
        ? {
            before: changes.before,
            after: changes.after,
            fieldsChanged:
              changes.before && changes.after
                ? compareObjects(changes.before, changes.after)
                : undefined,
          }
        : undefined,
      metadata: {
        severity: ['approve', 'reject'].includes(action) ? 'high' : 'medium',
        category: 'leave',
        compliance: true,
      },
    },
    req,
  )
}

// Function to add audit hooks to collections
export function addAuditHooks(collectionConfig: any) {
  const originalHooks = collectionConfig.hooks || {}

  collectionConfig.hooks = {
    ...originalHooks,

    afterChange: [
      ...(originalHooks.afterChange || []),
      async ({ doc, previousDoc, operation, req }: any) => {
        const payload = req.payload

        if (operation === 'create') {
          await createAuditLog(
            payload,
            {
              action: `Created ${collectionConfig.slug} record`,
              operationType: 'create',
              collection: collectionConfig.slug,
              documentId: doc.id,
              changes: {
                after: doc,
              },
            },
            req,
          )
        } else if (operation === 'update') {
          const fieldsChanged = compareObjects(previousDoc, doc)

          await createAuditLog(
            payload,
            {
              action: `Updated ${collectionConfig.slug} record`,
              operationType: 'update',
              collection: collectionConfig.slug,
              documentId: doc.id,
              changes: {
                before: previousDoc,
                after: doc,
                fieldsChanged,
              },
            },
            req,
          )
        }
      },
    ],

    afterDelete: [
      ...(originalHooks.afterDelete || []),
      async ({ doc, req }: any) => {
        const payload = req.payload

        await createAuditLog(
          payload,
          {
            action: `Deleted ${collectionConfig.slug} record`,
            operationType: 'delete',
            collection: collectionConfig.slug,
            documentId: doc.id,
            changes: {
              before: doc,
            },
          },
          req,
        )
      },
    ],
  }

  return collectionConfig
}
