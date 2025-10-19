import type { CollectionConfig } from 'payload'

export const Reports: CollectionConfig = {
  slug: 'reports',
  admin: {
    useAsTitle: 'title',
    group: 'Analytics',
    components: {
      beforeListTable: ['@/collections/components/ReportsDashboard#ReportsDashboard'],
    },
  },
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.role === 'admin') return true
      if (req.user.role === 'squadLead') return true
      return { createdBy: { equals: req.user.id } }
    },
    create: ({ req }) => {
      if (!req.user) return false
      return ['admin', 'squadLead'].includes(req.user.role)
    },
    update: ({ req }) => {
      if (!req.user) return false
      if (req.user.role === 'admin') return true
      return { createdBy: { equals: req.user.id } }
    },
    delete: ({ req }) => {
      if (!req.user) return false
      if (req.user.role === 'admin') return true
      return { createdBy: { equals: req.user.id } }
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'reportType',
      type: 'select',
      required: true,
      options: [
        { label: 'Daily Attendance', value: 'daily' },
        { label: 'Weekly Summary', value: 'weekly' },
        { label: 'Sprint Report', value: 'sprint' },
        { label: 'Squad Analysis', value: 'squad' },
        { label: 'Compliance Report', value: 'compliance' },
        { label: 'Custom Query', value: 'custom' },
      ],
    },
    {
      name: 'dateRange',
      type: 'group',
      fields: [
        {
          name: 'startDate',
          type: 'date',
          required: true,
        },
        {
          name: 'endDate',
          type: 'date',
          required: true,
        },
      ],
    },
    {
      name: 'filters',
      type: 'group',
      fields: [
        {
          name: 'squads',
          type: 'relationship',
          relationTo: 'squads',
          hasMany: true,
        },
        {
          name: 'users',
          type: 'relationship',
          relationTo: 'users',
          hasMany: true,
        },
        {
          name: 'sprints',
          type: 'relationship',
          relationTo: 'sprints',
          hasMany: true,
        },
        {
          name: 'complianceStatus',
          type: 'select',
          hasMany: true,
          options: [
            { label: 'Compliant', value: 'compliant' },
            { label: 'Late', value: 'late' },
            { label: 'Early Checkout', value: 'earlyCheckout' },
            { label: 'Overtime', value: 'overtime' },
            { label: 'Missed Checkout', value: 'missedCheckout' },
          ],
        },
      ],
    },
    {
      name: 'metrics',
      type: 'group',
      admin: {
        description: 'Calculated metrics for this report (auto-populated)',
      },
      fields: [
        {
          name: 'totalMembers',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'totalAttendanceLogs',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'complianceRate',
          type: 'number',
          admin: {
            readOnly: true,
            description: 'Decimal value (0.0 - 1.0)',
          },
        },
        {
          name: 'averageWorkingHours',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'absenceDays',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'topPerformingSquads',
          type: 'json',
          admin: {
            readOnly: true,
            description: 'Array of squad performance data',
          },
        },
      ],
    },
    {
      name: 'automation',
      type: 'group',
      fields: [
        {
          name: 'autoGenerate',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'frequency',
          type: 'select',
          admin: {
            condition: (data) => data.automation?.autoGenerate,
          },
          options: [
            { label: 'Daily', value: 'daily' },
            { label: 'Weekly', value: 'weekly' },
            { label: 'End of Sprint', value: 'sprint' },
            { label: 'Monthly', value: 'monthly' },
          ],
        },
        {
          name: 'emailRecipients',
          type: 'array',
          admin: {
            condition: (data) => data.automation?.autoGenerate,
          },
          fields: [
            {
              name: 'email',
              type: 'email',
              required: true,
            },
            {
              name: 'role',
              type: 'text',
            },
          ],
        },
        {
          name: 'nextScheduledRun',
          type: 'date',
          admin: {
            readOnly: true,
            condition: (data) => data.automation?.autoGenerate,
          },
        },
      ],
    },
    {
      name: 'exportOptions',
      type: 'group',
      fields: [
        {
          name: 'format',
          type: 'select',
          hasMany: true,
          options: [
            { label: 'CSV', value: 'csv' },
            { label: 'PDF', value: 'pdf' },
            { label: 'Excel', value: 'xlsx' },
            { label: 'JSON', value: 'json' },
          ],
          defaultValue: ['csv'],
        },
        {
          name: 'includeCharts',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'includeRawData',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Generated', value: 'generated' },
        { label: 'Sent', value: 'sent' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    {
      name: 'generatedData',
      type: 'json',
      admin: {
        readOnly: true,
        description: 'Raw data used to generate this report',
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { readOnly: true },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation === 'create' && req.user) {
          data.createdBy = req.user.id
        }

        // Auto-calculate next scheduled run for automated reports
        if (data.automation?.autoGenerate && data.automation?.frequency) {
          const now = new Date()
          let nextRun = new Date(now)

          switch (data.automation.frequency) {
            case 'daily':
              nextRun.setDate(now.getDate() + 1)
              break
            case 'weekly':
              nextRun.setDate(now.getDate() + 7)
              break
            case 'monthly':
              nextRun.setMonth(now.getMonth() + 1)
              break
            case 'sprint':
              // TODO: Calculate based on active sprint end date
              nextRun.setDate(now.getDate() + 14) // Default 2 weeks
              break
          }

          data.automation.nextScheduledRun = nextRun.toISOString()
        }

        return data
      },
    ],
  },
}
