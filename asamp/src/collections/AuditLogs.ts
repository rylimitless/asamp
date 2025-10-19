import type { CollectionConfig } from 'payload'

export const AuditLogs: CollectionConfig = {
  slug: 'auditLogs',
  admin: {
    useAsTitle: 'action',
    defaultColumns: ['action', 'performedBy', 'timestamp'],
  },
  fields: [
    {
      name: 'action',
      type: 'text',
      required: true,
      admin: {
        description: 'Description of the action performed (e.g. "check-in updated")',
      },
    },
    {
      name: 'performedBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'User who performed the action',
      },
    },
    {
      name: 'timestamp',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'When the action was performed',
      },
    },
    {
      name: 'oldValue',
      type: 'json',
      required: false,
      admin: {
        description: 'Previous state of the record before change',
      },
    },
    {
      name: 'newValue',
      type: 'json',
      required: false,
      admin: {
        description: 'New state of the record after change',
      },
    },
  ],
}
