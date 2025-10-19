import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  access: {
    // Admin can manage all
    // create: ({ req: { user } }) => {
    //   return user?.role === 'admin'
    // },
    // read: ({ req: { user } }) => {
    //   if (!user) return false
    //   if (user.role === 'admin') return true
    //   if (user.role === 'squadLead') {
    //     // Squad leads can view their squad members
    //     // return {
    //     //   squad: {
    //     //     equals: user?.squad,
    //     //   },
    //     // }
    //   }
    //   // Members and viewers can only see their own profile
    //   return {
    //     id: {
    //       equals: user.id,
    //     },
    //   }
    // },
    // update: ({ req: { user } }) => {
    //   if (user?.role === 'admin') return true
    //   if (user?.role === 'squadLead') {
    //     // Squad leads can edit their squad members
    //     return {
    //       squad: {
    //         equals: user?.squad,
    //       },
    //     }
    //   }
    //   // Members and viewers can only edit their own profile
    //   return {
    //     id: {
    //       equals: user?.id,
    //     },
    //   }
    // },
    // delete: ({ req: { user } }) => {
    //   return user?.role === 'admin'
    // },
  },
  fields: [
    // Email added by default by auth: true
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: [
        {
          label: 'Admin',
          value: 'admin',
        },
        {
          label: 'Squad Lead',
          value: 'squadLead',
        },
        {
          label: 'Member',
          value: 'member',
        },
        {
          label: 'Viewer',
          value: 'viewer',
        },
      ],
    },
    {
      name: 'squad',
      type: 'relationship',
      relationTo: 'squads',
      required: false,
    },
    {
      name: 'workMode',
      type: 'select',
      required: true,
      defaultValue: 'remote',
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
      name: 'timeZone',
      type: 'text',
      required: true,
      defaultValue: 'UTC',
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'lastCheckIn',
      type: 'date',
      required: false,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
  ],
}
