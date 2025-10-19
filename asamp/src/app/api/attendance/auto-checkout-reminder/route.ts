import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

export async function POST(request: NextRequest) {
  try {
    // Verify this is an authorized request (you should add proper authentication)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })

    // Get today's date
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find all attendance logs that are checked in but not checked out
    const openLogs = await payload.find({
      collection: 'attendanceLogs',
      where: {
        and: [
          {
            date: {
              greater_than_equal: today.toISOString(),
            },
          },
          {
            checkOutTime: {
              exists: false,
            },
          },
        ],
      },
      limit: 1000,
    })

    const notifications = []

    // Create reminder notifications for each user
    for (const log of openLogs.docs) {
      const userId = typeof log.user === 'string' ? log.user : log.user.id

      const notification = await payload.create({
        collection: 'notifications',
        data: {
          title: 'Check-out Reminder',
          message: "Don't forget to check out for today!",
          type: 'reminder',
          recipient: userId,
          related: {
            relationTo: 'attendanceLogs',
            value: log.id,
          },
          isRead: false,
          sentAt: new Date().toISOString(),
        },
      })

      notifications.push(notification)
    }

    return NextResponse.json({
      success: true,
      reminders: notifications.length,
      message: `Sent ${notifications.length} check-out reminders`,
    })
  } catch (error) {
    console.error('Auto-checkout reminder error:', error)
    return NextResponse.json({ error: 'Failed to send reminders' }, { status: 500 })
  }
}
