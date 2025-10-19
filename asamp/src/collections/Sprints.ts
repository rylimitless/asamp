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
      name: 'tags',
      type: 'array',
      fields: [
        {
          name: 'tag',
          type: 'select',
          options: [
            { label: 'Standup', value: 'standup' },
            { label: 'Retro', value: 'retro' },
            { label: 'Planning', value: 'planning' },
            { label: 'Review', value: 'review' },
            { label: 'Refinement', value: 'refinement' },
            { label: 'Demo', value: 'demo' },
          ],
        },
      ],
      required: false,
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
