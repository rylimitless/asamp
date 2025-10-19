import type { CollectionConfig } from 'payload'

export const Notifications: CollectionConfig = {
  slug: 'notifications',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'recipient', 'isRead', 'sentAt'],
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