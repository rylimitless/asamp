import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { AttendanceLog, User as UserType, Squad as SquadType } from '@/payload-types'

function formatCSV(data: any[]): string {
  if (!data.length) return ''

  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value ?? ''
        })
        .join(','),
    ),
  ]

  return csvRows.join('\n')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const period = searchParams.get('period') || 'month'
    const squadFilter = searchParams.get('squad')

    const payload = await getPayload({ config })

    // Calculate date range
    const now = new Date()
    let start: Date
    let end = new Date(now)

    switch (period) {
      case 'today':
        start = new Date(now)
        start.setHours(0, 0, 0, 0)
        break
      case 'week':
        start = new Date(now)
        start.setDate(now.getDate() - now.getDay())
        start.setHours(0, 0, 0, 0)
        break
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      default:
        start = new Date(now)
        start.setDate(now.getDate() - 30)
    }

    // Build query
    const attendanceWhere: any = {
      and: [
        { date: { greater_than_equal: start.toISOString() } },
        { date: { less_than_equal: end.toISOString() } },
      ],
    }

    if (squadFilter) {
      attendanceWhere.and.push({ squad: { equals: squadFilter } })
    }

    // Fetch attendance data
    const attendanceRes = await payload.find({
      collection: 'attendanceLogs',
      where: attendanceWhere,
      limit: 10000,
      depth: 2, // Include related user/squad data
    })

    const logs = attendanceRes.docs as AttendanceLog[]

    // Transform data for export
    const exportData = logs.map((log) => {
      const user = log.user as UserType
      const squad = log.squad as SquadType

      return {
        Date: log.date?.split('T')[0],
        'User Name': user?.email || 'Unknown',
        Squad: squad?.name || 'No Squad',
        'Check In': log.checkInTime || '',
        'Check Out': log.checkOutTime || '',
        'Total Hours': log.totalHours || 0,
        'Late Minutes': log.lateMinutes || 0,
        'Compliance Status': log.complianceStatus || '',
        Notes: log.notes || '',
      }
    })

    // Generate export based on format
    if (format === 'csv') {
      const csvContent = formatCSV(exportData)
      const filename = `attendance-report-${period}-${new Date().toISOString().split('T')[0]}.csv`

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    if (format === 'json') {
      const filename = `attendance-report-${period}-${new Date().toISOString().split('T')[0]}.json`

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // Default to JSON if format not supported
    return NextResponse.json({
      error: 'Format not supported yet',
      supportedFormats: ['csv', 'json'],
      data: exportData,
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate export',
      },
      { status: 500 },
    )
  }
}
