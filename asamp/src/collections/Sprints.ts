import type { CollectionConfig } from 'payload'

export const Sprints: CollectionConfig = {
  slug: 'sprints',
  admin: {
    useAsTitle: 'name',
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
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'startDate',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'endDate',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'squad',
      type: 'relationship',
      relationTo: 'squads',
      required: true,
    },
    {
      name: 'Tags', // required
      type: 'select', // required
      hasMany: true,
      admin: {
        isClearable: true,
        isSortable: true, // use mouse to drag and drop different values, and sort them according to your choice
      },
      options: [
        {
          label: 'Standup',
          value: 'standup',
        },
        {
          label: 'Retro',
          value: 'retro',
        },
        {
          label: 'Sprint Planning',
          value: 'planning',
        },
        {
          label: 'Demo',
          value: 'demo',
        },
      ],
    },

    {
      name: 'linkedJiraSprintId',
      type: 'text',
      required: false,
      admin: {
        description: 'External Jira sprint ID for integration',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Mark as true if this is the current active sprint',
      },
    },
  ],
}
