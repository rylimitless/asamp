import type { CollectionConfig } from 'payload'

export const Sprints: CollectionConfig = {
  slug: 'sprints',
  admin: {
    useAsTitle: 'name',
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
