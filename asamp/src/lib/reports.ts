import type { Payload } from 'payload'
import type { Report, AttendanceLog, User as UserType, Squad as SquadType } from '@/payload-types'

interface EmailReportParams {
  reportId: string
  recipientEmail: string
  payload: Payload
}

export async function generateAutomatedReport(reportId: string, payload: Payload) {
  try {
    // Fetch the report configuration
    const reportRes = await payload.findByID({
      collection: 'reports',
      id: reportId,
      depth: 2,
    })

    if (!reportRes) {
      throw new Error(`Report ${reportId} not found`)
    }

    const report = reportRes as Report

    // Calculate metrics based on report configuration
    const metrics = await calculateReportMetrics(report, payload)

    // Update the report with calculated metrics
    await payload.update({
      collection: 'reports',
      id: reportId,
      data: {
        metrics,
        status: 'generated',
        generatedData: {
          generatedAt: new Date().toISOString(),
          metrics,
          rawDataCount: metrics.totalAttendanceLogs,
        },
      },
    })

    // Send emails if configured
    if (report.automation?.autoGenerate && report.automation.emailRecipients) {
      for (const recipient of report.automation.emailRecipients) {
        await sendReportEmail({
          reportId,
          recipientEmail: recipient.email,
          payload,
        })
      }

      // Update report status to sent
      await payload.update({
        collection: 'reports',
        id: reportId,
        data: { status: 'sent' },
      })
    }

    console.log(`Report ${reportId} generated successfully`)
    return { success: true, metrics }
  } catch (error) {
    console.error(`Failed to generate report ${reportId}:`, error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
}

async function calculateReportMetrics(report: Report, payload: Payload) {
  const { dateRange, filters } = report

  // Build attendance query
  const attendanceWhere: any = {
    and: [
      { date: { greater_than_equal: dateRange.startDate } },
      { date: { less_than_equal: dateRange.endDate } },
    ],
  }

  if (filters?.squads?.length) {
    attendanceWhere.and.push({
      squad: { in: filters.squads.map((s) => (typeof s === 'string' ? s : s.id)) },
    })
  }

  if (filters?.users?.length) {
    attendanceWhere.and.push({
      user: { in: filters.users.map((u) => (typeof u === 'string' ? u : u.id)) },
    })
  }

  if (filters?.complianceStatus?.length) {
    attendanceWhere.and.push({
      complianceStatus: { in: filters.complianceStatus },
    })
  }

  // Fetch attendance data
  const attendanceRes = await payload.find({
    collection: 'attendanceLogs',
    where: attendanceWhere,
    limit: 10000,
    depth: 1,
  })

  const logs = attendanceRes.docs as AttendanceLog[]

  // Calculate metrics
  const uniqueUsers = new Set(
    logs.map((log) => (typeof log.user === 'object' ? (log.user as any).id : log.user)),
  )

  const compliantLogs = logs.filter((log) => log.complianceStatus === 'compliant')
  const complianceRate = logs.length > 0 ? compliantLogs.length / logs.length : 0

  const totalHours = logs.reduce((sum, log) => sum + (log.totalHours || 0), 0)
  const averageWorkingHours = logs.length > 0 ? totalHours / logs.length : 0

  // Calculate squad performance
  const squadPerformance = new Map()
  logs.forEach((log) => {
    const squadId = typeof log.squad === 'object' ? (log.squad as any)?.id : log.squad
    if (!squadId) return

    if (!squadPerformance.has(squadId)) {
      squadPerformance.set(squadId, {
        name: typeof log.squad === 'object' ? (log.squad as any)?.name : 'Unknown Squad',
        totalHours: 0,
        compliantLogs: 0,
        totalLogs: 0,
      })
    }

    const squad = squadPerformance.get(squadId)
    squad.totalHours += log.totalHours || 0
    squad.totalLogs += 1
    if (log.complianceStatus === 'compliant') {
      squad.compliantLogs += 1
    }
  })

  const topPerformingSquads = Array.from(squadPerformance.values())
    .map((squad) => ({
      name: squad.name,
      score: squad.totalLogs > 0 ? squad.compliantLogs / squad.totalLogs : 0,
      averageHours: squad.totalLogs > 0 ? squad.totalHours / squad.totalLogs : 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  // Calculate absence days
  const startDate = new Date(dateRange.startDate)
  const endDate = new Date(dateRange.endDate)
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const attendanceDates = new Set(logs.map((log) => log.date?.split('T')[0]))
  const absenceDays = Math.max(0, totalDays - attendanceDates.size)

  return {
    totalMembers: uniqueUsers.size,
    totalAttendanceLogs: logs.length,
    complianceRate,
    averageWorkingHours,
    absenceDays,
    topPerformingSquads,
  }
}

async function sendReportEmail({ reportId, recipientEmail, payload }: EmailReportParams) {
  // In a real implementation, you would integrate with an email service like:
  // - SendGrid
  // - AWS SES
  // - Nodemailer
  // - Payload's email functionality (if configured)

  console.log(`Sending report ${reportId} to ${recipientEmail}`)

  // Find the user by email to get the user ID for the notification
  try {
    const userRes = await payload.find({
      collection: 'users',
      where: { email: { equals: recipientEmail } },
      limit: 1,
    })

    if (userRes.docs.length > 0) {
      const user = userRes.docs[0]

      // Create a notification in the system
      await payload.create({
        collection: 'notifications',
        data: {
          type: 'report',
          title: 'Automated Attendance Report',
          message: `Your scheduled attendance report has been generated. Report ID: ${reportId}`,
          recipient: user.id,
          isRead: false,
          sentAt: new Date().toISOString(),
        },
      })
    }
  } catch (error) {
    console.error('Failed to create notification:', error)
  }

  // TODO: Implement actual email sending
  return { success: true }
}

export async function scheduleAutomatedReports(payload: Payload) {
  // Find all reports that need to be generated
  const now = new Date()
  const reportsRes = await payload.find({
    collection: 'reports',
    where: {
      and: [
        { 'automation.autoGenerate': { equals: true } },
        { 'automation.nextScheduledRun': { less_than_equal: now.toISOString() } },
        { status: { not_equals: 'archived' } },
      ],
    },
  })

  const reports = reportsRes.docs as Report[]

  for (const report of reports) {
    await generateAutomatedReport(report.id, payload)

    // Calculate next run time
    const nextRun = calculateNextRunTime(report.automation?.frequency || 'weekly')

    await payload.update({
      collection: 'reports',
      id: report.id,
      data: {
        automation: {
          ...report.automation,
          nextScheduledRun: nextRun.toISOString(),
        },
      },
    })
  }

  return { processedReports: reports.length }
}

function calculateNextRunTime(frequency: string): Date {
  const now = new Date()

  switch (frequency) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000)
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    case 'monthly':
      const nextMonth = new Date(now)
      nextMonth.setMonth(now.getMonth() + 1)
      return nextMonth
    case 'sprint':
      // Default to 2 weeks for sprint cycle
      return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  }
}
