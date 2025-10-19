import type { CollectionConfig } from 'payload'

export const Notifications: CollectionConfig = {
  slug: 'notifications',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'recipient', 'isRead', 'sentAt'],
  },
  hooks: {
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
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Short title like "Missed Check-in"',
      },
    },
    {
      name: 'message',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Main message content',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Check-in',
          value: 'checkin',
        },
        {
          label: 'Leave',
          value: 'leave',
        },
        {
          label: 'Reminder',
          value: 'reminder',
        },
        {
          label: 'Report',
          value: 'report',
        },
        {
          label: 'System',
          value: 'system',
        },
      ],
    },
    {
      name: 'recipient',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'User who will receive this notification',
      },
    },
    {
      name: 'related',
      type: 'relationship',
      relationTo: ['attendanceLogs', 'leaveRequests', 'sprints', 'squads'],
      required: false,
      admin: {
        description: 'Link to related record (e.g. a leave request)',
      },
    },
    {
      name: 'isRead',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Has the user seen this notification?',
      },
    },
    {
      name: 'sentAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'When the notification was created/sent',
      },
    },
  ],
}
