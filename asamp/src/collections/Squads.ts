import type { CollectionConfig } from 'payload'

export const Squads: CollectionConfig = {
  slug: 'squads',
  admin: {
    useAsTitle: 'name',
    components: {
      beforeListTable: [
        {
          path: 'src/collections/components/SquadPresenceBoard.tsx#SquadPresenceBoard',
        },
      ],
    },
  },
  access: {
    // Only admins can create squads
    create: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
    // Admins see all, squad leads see squads they lead/are members of, members see only their squad, viewers see all
    read: ({ req: { user } }): any => {
      if (!user) return false
      if (user.role === 'admin' || user.role === 'viewer') return true

      const userSquadId =
        typeof user.squad === 'object' && user.squad !== null ? user.squad.id : user.squad

      if (user.role === 'squadLead') {
        // Squad leads can see squads where they are lead, member, or assigned squad
        const conditions: any[] = [
          { lead: { equals: user.id } },
          { members: { contains: user.id } },
        ]
        if (userSquadId) {
          conditions.push({ id: { equals: userSquadId } })
        }
        return {
          or: conditions,
        }
      }
      // Members can only see their assigned squad
      if (!userSquadId) return false
      return {
        id: { equals: userSquadId },
      }
    },
    // Admins can update all, squad leads can update squads they lead
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      if (user.role === 'squadLead') {
        return {
          lead: { equals: user.id },
        }
      }
      return false
    },
    // Only admins can delete squads
    delete: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'text',
      required: false,
    },
    {
      name: 'lead',
      type: 'relationship',
      relationTo: 'users',
      required: false,
    },
    {
      name: 'members',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      required: false,
    },
    {
      name: 'project',
      type: 'text',
      required: false,
    },
    {
      name: 'timeZone',
      type: 'text',
      required: true,
      defaultValue: 'UTC',
    },
    {
      name: 'workdays',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Monday', value: 'Monday' },
        { label: 'Tuesday', value: 'Tuesday' },
        { label: 'Wednesday', value: 'Wednesday' },
        { label: 'Thursday', value: 'Thursday' },
        { label: 'Friday', value: 'Friday' },
        { label: 'Saturday', value: 'Saturday' },
        { label: 'Sunday', value: 'Sunday' },
      ],
      defaultValue: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    {
      name: 'activeSprint',
      type: 'relationship',
      relationTo: 'sprints',
      required: false,
    },
    {
      name: 'complianceScore',
      type: 'number',
      required: false,
      admin: {
        readOnly: true,
        description: 'Calculated weekly, auto-populated',
      },
    },
    {
      name: 'statusBoard',
      type: 'json',
      required: false,
      admin: {
        description: 'Real-time status summary',
      },
    },
  ],
}
