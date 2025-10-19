import type { CollectionConfig } from 'payload'
import { addAuditHooks, logAttendanceAction } from '@/lib/audit'

const AttendanceConfig: CollectionConfig = {
  slug: 'attendanceLogs',
  admin: {
    useAsTitle: 'user',
    defaultColumns: ['user', 'squad', 'date', 'checkInTime', 'workMode', 'complianceStatus'],
    components: {
      beforeListTable: [
        {
          path: 'src/collections/components/AttendanceButtons.tsx#AttendanceButtons',
        },
      ],
    },
  },
  hooks: {
    beforeChange: [
      // Auto-calculate compliance when attendance is saved
      async ({ data, operation, req }: any) => {
        if (operation === 'create' || operation === 'update') {
          // Calculate compliance status
          data.complianceStatus = await calculateCompliance(data, req.payload)
        }
        return data
      },
    ],
    afterChange: [
      // Paste inside the collection's hooks.afterChange array
      async ({ doc, previousDoc, req, operation, collection }) => {
        // Avoid self-logging if accidentally added to AuditLogs
        if (collection?.slug === 'auditLogs') return

        const { payload, user } = req
        if (!user?.id) return // performedBy is required; skip if unauthenticated/system

        const verb =
          operation === 'create' ? 'created' : operation === 'update' ? 'updated' : operation
        const entity = collection?.slug ?? 'document'
        const action = `${entity} ${verb}`

        try {
          const oldValue = operation === 'update' ? (previousDoc ?? null) : null
          const newValue = doc

          const data = {
            action: 'UPDATED',
            performedBy: user.id,
            oldValue,
            newValue,
            // If AuditLog['timestamp'] is Date:
            timestamp: new Date().toISOString(),
            // If it's a string, use ISO instead:
            // timestamp: new Date().toISOString(),
          }

          await payload.create({
            collection: 'auditLogs',
            overrideAccess: true, // bypass create: false on AuditLogs
            data,
          })
        } catch (err) {
          // Don't block the main operation
          console.error('Failed to write audit log:', err)
        }
      },
    ],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'squad',
      type: 'relationship',
      relationTo: 'squads',
      required: true,
    },
    {
      name: 'sprint',
      type: 'relationship',
      relationTo: 'sprints',
      required: false,
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'checkInTime',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'checkOutTime',
      type: 'date',
      required: false,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'location',
      type: 'text',
      required: false,
      admin: {
        description: 'IP address or geolocation data',
      },
    },
    {
      name: 'workMode',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Remote',
          value: 'remote',
        },
        {
          label: 'Office',
          value: 'office',
        },
        {
          label: 'Client Site',
          value: 'client-site',
        },
        {
          label: 'Out of Office',
          value: 'ooo',
        },
      ],
    },
    // === NEW COMPLIANCE FIELDS ===
    {
      name: 'totalHours',
      type: 'number',
      required: false,
      admin: {
        readOnly: true,
        description: 'Auto-calculated from check-in/out times',
        step: 0.25,
      },
    },
    {
      name: 'complianceStatus',
      type: 'select',
      required: false,
      admin: {
        readOnly: true,
        description: 'Auto-calculated compliance status',
      },
      options: [
        { label: 'Compliant', value: 'compliant' },
        { label: 'Late Check-in', value: 'late-checkin' },
        { label: 'Early Check-out', value: 'early-checkout' },
        { label: 'Insufficient Hours', value: 'insufficient-hours' },
        { label: 'Missing Check-out', value: 'missing-checkout' },
        { label: 'Pending', value: 'pending' },
      ],
    },
    {
      name: 'complianceNotes',
      type: 'textarea',
      required: false,
      admin: {
        readOnly: true,
        description: 'Auto-generated compliance details',
      },
    },
    {
      name: 'lateMinutes',
      type: 'number',
      required: false,
      admin: {
        readOnly: true,
        description: 'Minutes late for check-in (if applicable)',
      },
    },
    {
      name: 'earlyCheckoutMinutes',
      type: 'number',
      required: false,
      admin: {
        readOnly: true,
        description: 'Minutes early for check-out (if applicable)',
      },
    },
    // === EXISTING FIELDS ===
    {
      name: 'flags',
      type: 'array',
      fields: [
        {
          name: 'flag',
          type: 'select',
          options: [
            { label: 'Partial Day', value: 'partial-day' },
            { label: 'Late', value: 'late' },
            { label: 'Leave', value: 'leave' },
            { label: 'Anomaly', value: 'anomaly' },
          ],
        },
      ],
      required: false,
    },
    {
      name: 'notes',
      type: 'textarea',
      required: false,
      admin: {
        description: 'Optional comments about the attendance record',
      },
    },
    {
      name: 'verified',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Mark as verified by auto-system or admin',
      },
    },
  ],
}

// Apply audit hooks to the collection
export const Attendance = addAuditHooks(AttendanceConfig)

// Compliance calculation function
async function calculateCompliance(data: any, payload: any) {
  try {
    // Get squad rules for compliance thresholds
    let squad = null
    if (data.squad) {
      squad = await payload.findByID({
        collection: 'squads',
        id: typeof data.squad === 'object' ? data.squad.id : data.squad,
      })
    }

    // Default thresholds (can be overridden by squad settings)
    const rules = {
      minimumHours: squad?.minimumWorkHours || 8,
      standardCheckInTime: squad?.standardCheckInTime || '09:00',
      standardCheckOutTime: squad?.standardCheckOutTime || '17:00',
      lateThresholdMinutes: squad?.lateThresholdMinutes || 15,
      earlyCheckoutThresholdMinutes: squad?.earlyCheckoutThresholdMinutes || 30,
    }

    if (!data.checkInTime) {
      return 'pending'
    }

    const checkInDate = new Date(data.checkInTime)
    const checkOutDate = data.checkOutTime ? new Date(data.checkOutTime) : null

    // Calculate total hours if checked out
    let totalHours = 0
    if (checkOutDate) {
      totalHours = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60)
      data.totalHours = Math.round(totalHours * 4) / 4 // Round to nearest 15 minutes
    }

    // Check late arrival
    const standardCheckIn = new Date(checkInDate)
    const [checkInHour, checkInMinute] = rules.standardCheckInTime.split(':').map(Number)
    standardCheckIn.setHours(checkInHour, checkInMinute, 0, 0)

    const lateMinutes = Math.max(
      0,
      (checkInDate.getTime() - standardCheckIn.getTime()) / (1000 * 60),
    )
    data.lateMinutes = Math.round(lateMinutes)

    // Check early checkout
    let earlyCheckoutMinutes = 0
    if (checkOutDate) {
      const standardCheckOut = new Date(checkOutDate)
      const [checkOutHour, checkOutMinute] = rules.standardCheckOutTime.split(':').map(Number)
      standardCheckOut.setHours(checkOutHour, checkOutMinute, 0, 0)

      earlyCheckoutMinutes = Math.max(
        0,
        (standardCheckOut.getTime() - checkOutDate.getTime()) / (1000 * 60),
      )
      data.earlyCheckoutMinutes = Math.round(earlyCheckoutMinutes)
    }

    // Determine compliance status
    const violations = []

    if (lateMinutes > rules.lateThresholdMinutes) {
      violations.push(`Late by ${Math.round(lateMinutes)} minutes`)
    }

    if (earlyCheckoutMinutes > rules.earlyCheckoutThresholdMinutes) {
      violations.push(`Early checkout by ${Math.round(earlyCheckoutMinutes)} minutes`)
    }

    if (checkOutDate && totalHours < rules.minimumHours) {
      violations.push(
        `Insufficient hours: ${totalHours.toFixed(2)}h (minimum: ${rules.minimumHours}h)`,
      )
    }

    if (!checkOutDate) {
      data.complianceNotes = 'Pending check-out'
      return 'missing-checkout'
    }

    if (violations.length > 0) {
      data.complianceNotes = violations.join('; ')

      // Prioritize violation types
      if (lateMinutes > rules.lateThresholdMinutes) return 'late-checkin'
      if (earlyCheckoutMinutes > rules.earlyCheckoutThresholdMinutes) return 'early-checkout'
      if (totalHours < rules.minimumHours) return 'insufficient-hours'
    }

    data.complianceNotes = `Total hours: ${totalHours.toFixed(2)}h - All requirements met`
    return 'compliant'
  } catch (error) {
    console.error('Compliance calculation error:', error)
    return 'pending'
  }
}
