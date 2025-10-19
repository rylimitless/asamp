import type { CollectionConfig } from 'payload'

export const Attendance: CollectionConfig = {
  slug: 'attendanceLogs',
  admin: {
    useAsTitle: 'user',
    defaultColumns: ['user', 'squad', 'date', 'checkInTime', 'workMode'],
    components: {
      beforeListTable: [
        {
          path: 'src/collections/components/AttendanceButtons.tsx#AttendanceButtons',
        },
      ],
    },
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
