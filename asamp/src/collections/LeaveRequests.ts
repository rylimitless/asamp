import type { CollectionConfig } from 'payload'

export const LeaveRequests: CollectionConfig = {
  slug: 'leaveRequests',
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') {
        // Admins can see all requests
        return true
      }

      if (user.role === 'squadLead') {
        // Get the squad ID, whether it's populated or just an ID string
        // const squadId = typeof user.squad === 'object' ? user.squad?.id : user.squad
        // if (!squadId) {
        //   // If squad lead has no squad, they can only see their own requests
        //   return {
        //     user: {
        //       equals: user.id,
        //     },
        //   }
        // }
        // return {
        //   'squad.lead': {
        //     equals: user.id,
        //   },
        // }

        return true
        // Squad leads can see requests from their squad OR their own requests
        // return {
        //   or: [
        //     {
        //       squad: {
        //         equals: squadId,
        //       },
        //     },
        //     {
        //       user: {
        //         equals: user.id,
        //       },
        //     },
        //   ],
        // }
      }

      // Members can only see their own leave requests
      return {
        user: {
          equals: user.id,
        },
      }
    },
  },
  admin: {
    useAsTitle: 'user',
    defaultColumns: ['user', 'squad', 'type', 'duration', 'status'],
  },
  timestamps: true,
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        // Auto-set approval fields when status changes
        if (operation === 'update' && req.user) {
          const previousStatus = originalDoc?.status
          const newStatus = data.status

          // When squad lead approves/rejects
          if (req.user.role === 'squadLead' && newStatus !== previousStatus) {
            if (newStatus === 'approved-squad-lead' || newStatus === 'rejected-squad-lead') {
              data.approvedBySquadLead = req.user.id
              data.squadLeadApprovalDate = new Date().toISOString()
            }
          }

          // When admin approves/rejects
          if (req.user.role === 'admin' && newStatus !== previousStatus) {
            if (newStatus === 'approved' || newStatus === 'rejected-admin') {
              data.approvedByAdmin = req.user.id
              data.adminApprovalDate = new Date().toISOString()
            }
          }

          // Auto-transition from squad lead approval to pending admin
          if (newStatus === 'approved-squad-lead') {
            data.status = 'pending-admin'
          }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, req, previousDoc, operation }) => {
        const payload = req.payload

        // When a new leave request is created, notify the squad lead
        if (operation === 'create') {
          // Get the squad to find the squad lead
          const squad = await payload.findByID({
            collection: 'squads',
            id: doc.squad,
          })

          if (squad?.lead) {
            await payload.create({
              collection: 'notifications',
              data: {
                title: 'New Leave Request',
                message: `A new leave request has been submitted and requires your approval.`,
                type: 'leave',
                recipient: squad.lead,
                related: {
                  relationTo: 'leaveRequests',
                  value: doc.id,
                },
                isRead: false,
                sentAt: new Date().toISOString(),
              },
            })
          }
        }

        // When status changes, handle notifications
        if (operation === 'update' && previousDoc?.status !== doc.status) {
          // Squad Lead approved → notify admins
          if (doc.status === 'pending-admin') {
            // Find all admin users
            const admins = await payload.find({
              collection: 'users',
              where: {
                role: {
                  equals: 'admin',
                },
              },
            })

            // Create notification for each admin
            for (const admin of admins.docs) {
              await payload.create({
                collection: 'notifications',
                data: {
                  title: 'Leave Request Pending Admin Approval',
                  message: `A leave request has been approved by the squad lead and requires final admin approval.`,
                  type: 'leave',
                  recipient: admin.id,
                  related: {
                    relationTo: 'leaveRequests',
                    value: doc.id,
                  },
                  isRead: false,
                  sentAt: new Date().toISOString(),
                },
              })
            }
          }

          // Final approval or rejection → notify the user
          if (
            doc.status === 'approved' ||
            doc.status === 'rejected-squad-lead' ||
            doc.status === 'rejected-admin'
          ) {
            const statusMessage =
              doc.status === 'approved'
                ? 'Your leave request has been approved.'
                : `Your leave request has been rejected.`

            await payload.create({
              collection: 'notifications',
              data: {
                title: 'Leave Request Update',
                message: statusMessage,
                type: 'leave',
                recipient: doc.user,
                related: {
                  relationTo: 'leaveRequests',
                  value: doc.id,
                },
                isRead: false,
                sentAt: new Date().toISOString(),
              },
            })
          }
        }
      },
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
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      defaultValue: ({ user }) => user?.id,
      admin: {
        condition: (data, siblingData, { user }) => {
          // Hide the field for members (it will be auto-filled)
          return user?.role === 'admin' || user?.role === 'squadLead'
        },
      },
      access: {
        read: () => true,
        update: ({ req: { user } }) => {
          // Only admins and squad leads can change the user
          return user?.role === 'admin' || user?.role === 'squadLead'
        },
      },
    },
    {
      name: 'squad',
      type: 'relationship',
      relationTo: 'squads',
      required: true,
      defaultValue: ({ user }) => user?.squad,
      admin: {
        condition: (data, siblingData, { user }) => {
          // Hide the field for members (it will be auto-filled)
          return user?.role === 'admin' || user?.role === 'squadLead'
        },
      },
      access: {
        read: () => true,
        update: ({ req: { user } }) => {
          // Only admins and squad leads can change the squad
          return user?.role === 'admin' || user?.role === 'squadLead'
        },
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Vacation',
          value: 'vacation',
        },
        {
          label: 'Sick Leave',
          value: 'sick',
        },
        {
          label: 'Public Holiday',
          value: 'public-holiday',
        },
        {
          label: 'Training',
          value: 'training',
        },
      ],
    },
    {
      name: 'reason',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Provide reason for leave request',
      },
    },
    {
      name: 'duration',
      type: 'text',
      required: true,
      admin: {
        description: 'Duration of leave (e.g., "2 weeks", "3 days", "1 month")',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending-squad-lead',
      options: [
        {
          label: 'Pending Squad Lead',
          value: 'pending-squad-lead',
        },
        {
          label: 'Rejected by Squad Lead',
          value: 'rejected-squad-lead',
        },
        {
          label: 'Pending Admin',
          value: 'pending-admin',
        },
        {
          label: 'Approved',
          value: 'approved',
        },
        {
          label: 'Rejected by Admin',
          value: 'rejected-admin',
        },
      ],
      access: {
        read: ({ req: { user } }) => {
          // Everyone can see status
          return true
        },
        update: ({ req: { user } }) => {
          // Only squad leads and admins can update status
          return user?.role === 'admin' || user?.role === 'squadLead'
        },
      },
    },
    {
      name: 'approvedBySquadLead',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      admin: {
        description: 'Squad Lead who approved/rejected the request',
        readOnly: true,
        condition: (data, siblingData, { user }) => {
          // Only show to squad leads and admins
          return user?.role === 'admin' || user?.role === 'squadLead'
        },
      },
      access: {
        read: ({ req: { user } }) => {
          return user?.role === 'admin' || user?.role === 'squadLead'
        },
        update: () => false, // Never allow manual updates
      },
    },
    {
      name: 'squadLeadApprovalDate',
      type: 'date',
      required: false,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        readOnly: true,
        condition: (data, siblingData, { user }) => {
          // Only show to squad leads and admins
          return user?.role === 'admin' || user?.role === 'squadLead'
        },
      },
      access: {
        read: ({ req: { user } }) => {
          return user?.role === 'admin' || user?.role === 'squadLead'
        },
        update: () => false, // Never allow manual updates
      },
    },
    {
      name: 'approvedByAdmin',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      admin: {
        description: 'Admin who gave final approval/rejection',
        readOnly: true,
        condition: (data, siblingData, { user }) => {
          // Only show to admins
          return user?.role === 'admin'
        },
      },
      access: {
        read: ({ req: { user } }) => {
          return user?.role === 'admin'
        },
        update: () => false, // Never allow manual updates
      },
    },
    {
      name: 'adminApprovalDate',
      type: 'date',
      required: false,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        readOnly: true,
        condition: (data, siblingData, { user }) => {
          // Only show to admins
          return user?.role === 'admin'
        },
      },
      access: {
        read: ({ req: { user } }) => {
          return user?.role === 'admin'
        },
        update: () => false, // Never allow manual updates
      },
    },
    {
      name: 'supportingDocs',
      type: 'upload',
      relationTo: 'media',
      required: false,
      admin: {
        description: 'Optional supporting documents (medical certificate, etc.)',
      },
    },
  ],
}
