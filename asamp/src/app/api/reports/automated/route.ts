import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { scheduleAutomatedReports, generateAutomatedReport } from '@/lib/reports'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('reportId')

    const payload = await getPayload({ config })

    if (reportId) {
      // Generate specific report
      const result = await generateAutomatedReport(reportId, payload)
      return NextResponse.json(result)
    } else {
      // Run scheduled reports
      const result = await scheduleAutomatedReports(payload)
      return NextResponse.json({
        success: true,
        message: `Processed ${result.processedReports} scheduled reports`,
        processedReports: result.processedReports,
      })
    }
  } catch (error) {
    console.error('Report generation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    )
  }
}

// GET endpoint to check scheduled reports
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Find reports that are scheduled for automation
    const reportsRes = await payload.find({
      collection: 'reports',
      where: {
        'automation.autoGenerate': { equals: true },
      },
      sort: 'automation.nextScheduledRun',
    })

    const scheduledReports = reportsRes.docs.map((report) => ({
      id: report.id,
      title: report.title,
      frequency: report.automation?.frequency,
      nextRun: report.automation?.nextScheduledRun,
      status: report.status,
      emailCount: report.automation?.emailRecipients?.length || 0,
    }))

    return NextResponse.json({
      success: true,
      scheduledReports,
      totalScheduled: scheduledReports.length,
    })
  } catch (error) {
    console.error('Scheduled reports check error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    )
  }
}
