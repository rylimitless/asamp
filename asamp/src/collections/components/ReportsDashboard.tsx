import type { Payload } from 'payload'
import type {
  AttendanceLog,
  User as UserType,
  Squad as SquadType,
  Sprint as SprintType,
} from '@/payload-types'

type AdminUser = Pick<UserType, 'id' | 'squad' | 'workMode' | 'role'>

interface DashboardMetrics {
  totalMembers: number
  totalAttendanceLogs: number
  complianceRate: number
  averageWorkingHours: number
  absenceDays: number
  topPerformingSquads: Array<{ name: string; score: number }>
  recentTrends: Array<{ date: string; attendance: number; compliance: number }>
}

function getDateRange(period: string) {
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
      start.setDate(now.getDate() - now.getDay()) // Start of week
      start.setHours(0, 0, 0, 0)
      break
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3)
      start = new Date(now.getFullYear(), quarter * 3, 1)
      break
    default:
      start = new Date(now)
      start.setDate(now.getDate() - 30) // Last 30 days
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

async function calculateDashboardMetrics(
  payload: Payload,
  period: string,
  squadFilter?: string,
  user?: AdminUser,
): Promise<DashboardMetrics> {
  const { start, end } = getDateRange(period)

  try {
    // Build attendance query with filters
    const attendanceWhere: any = {
      and: [{ date: { greater_than_equal: start } }, { date: { less_than_equal: end } }],
    }

    if (squadFilter) {
      attendanceWhere.and.push({ squad: { equals: squadFilter } })
    }

    // Fetch attendance logs
    const attendanceRes = await payload.find({
      collection: 'attendanceLogs',
      where: attendanceWhere,
      limit: 10000,
      user,
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

    // Count absence days (days without any attendance)
    const attendanceDates = new Set(logs.map((log) => log.date?.split('T')[0]))
    const totalDays = Math.ceil(
      (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24),
    )
    const absenceDays = Math.max(0, totalDays - attendanceDates.size)

    return {
      totalMembers: uniqueUsers.size,
      totalAttendanceLogs: logs.length,
      complianceRate,
      averageWorkingHours,
      absenceDays,
      topPerformingSquads: [], // TODO: Calculate squad performance
      recentTrends: [], // TODO: Calculate daily trends
    }
  } catch (error) {
    console.error('Dashboard metrics calculation error:', error)
    return {
      totalMembers: 0,
      totalAttendanceLogs: 0,
      complianceRate: 0,
      averageWorkingHours: 0,
      absenceDays: 0,
      topPerformingSquads: [],
      recentTrends: [],
    }
  }
}

export async function ReportsDashboard({
  payload,
  searchParams,
  user,
}: {
  payload: Payload
  searchParams: { [key: string]: string | undefined }
  user?: AdminUser
}) {
  if (!user) {
    return (
      <div style={{ padding: 16, color: 'var(--theme-error-700)' }}>
        You must be logged in to view reports.
      </div>
    )
  }

  const selectedPeriod = searchParams.period || 'month'
  const selectedSquad = searchParams.squad
  const viewType = searchParams.view || 'overview'

  // Fetch squads for filter dropdown
  const squadsRes = await payload.find({
    collection: 'squads',
    limit: 100,
    user,
  })
  const squads = squadsRes.docs as SquadType[]

  // Calculate dashboard metrics
  const metrics = await calculateDashboardMetrics(payload, selectedPeriod, selectedSquad, user)

  const periodOptions = [
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'week' },
    { label: 'This Month', value: 'month' },
    { label: 'This Quarter', value: 'quarter' },
  ]

  const viewOptions = [
    { label: 'Overview', value: 'overview' },
    { label: 'Drill-down', value: 'drilldown' },
    { label: 'Trends', value: 'trends' },
    { label: 'Export', value: 'export' },
  ]

  return (
    <div
      style={{
        margin: '12px 0 16px 0',
        background: 'var(--theme-elevation-0)',
        border: '1px solid var(--theme-elevation-200)',
        borderRadius: 8,
      }}
    >
      {/* Header with filters */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--theme-elevation-100)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ margin: 0, color: 'var(--theme-elevation-800)', fontSize: 18 }}>
          📊 Attendance Dashboard
        </h2>

        <form
          method="GET"
          style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}
        >
          <select
            name="period"
            defaultValue={selectedPeriod}
            style={{
              padding: '6px 8px',
              borderRadius: 4,
              border: '1px solid var(--theme-elevation-200)',
              background: 'var(--theme-elevation-0)',
              color: 'var(--theme-elevation-800)',
              fontSize: 13,
            }}
          >
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            name="squad"
            defaultValue={selectedSquad || ''}
            style={{
              padding: '6px 8px',
              borderRadius: 4,
              border: '1px solid var(--theme-elevation-200)',
              background: 'var(--theme-elevation-0)',
              color: 'var(--theme-elevation-800)',
              fontSize: 13,
            }}
          >
            <option value="">All Squads</option>
            {squads.map((squad) => (
              <option key={squad.id} value={squad.id}>
                {squad.name}
              </option>
            ))}
          </select>

          <select
            name="view"
            defaultValue={viewType}
            style={{
              padding: '6px 8px',
              borderRadius: 4,
              border: '1px solid var(--theme-elevation-200)',
              background: 'var(--theme-elevation-0)',
              color: 'var(--theme-elevation-800)',
              fontSize: 13,
            }}
          >
            {viewOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            style={{
              padding: '6px 12px',
              borderRadius: 4,
              border: '1px solid var(--theme-accent-700)',
              background: 'var(--theme-accent-600)',
              color: 'var(--theme-elevation-0)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Update
          </button>
        </form>
      </div>

      {/* Metrics Cards */}
      <div
        style={{
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <MetricCard
          title="Team Members"
          value={metrics.totalMembers}
          icon="👥"
          color="var(--theme-accent-600)"
        />
        <MetricCard
          title="Attendance Logs"
          value={metrics.totalAttendanceLogs}
          icon="📝"
          color="var(--theme-success-600)"
        />
        <MetricCard
          title="Compliance Rate"
          value={`${Math.round(metrics.complianceRate * 100)}%`}
          icon="✅"
          color={
            metrics.complianceRate > 0.8 ? 'var(--theme-success-600)' : 'var(--theme-warning-600)'
          }
        />
        <MetricCard
          title="Avg Hours/Day"
          value={metrics.averageWorkingHours.toFixed(1)}
          icon="⏰"
          color="var(--theme-elevation-600)"
        />
        <MetricCard
          title="Absence Days"
          value={metrics.absenceDays}
          icon="🚫"
          color={metrics.absenceDays > 5 ? 'var(--theme-error-600)' : 'var(--theme-elevation-600)'}
        />
      </div>

      {/* Quick Actions */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid var(--theme-elevation-100)',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <QuickActionButton
          href={`/api/reports/export?format=csv&period=${selectedPeriod}${selectedSquad ? `&squad=${selectedSquad}` : ''}`}
          icon="📄"
          label="Export CSV"
          description="Download attendance data"
        />
        <QuickActionButton
          href={`/api/reports/export?format=json&period=${selectedPeriod}${selectedSquad ? `&squad=${selectedSquad}` : ''}`}
          icon="📋"
          label="Export JSON"
          description="Download raw data"
        />
        <QuickActionButton
          href="?view=drilldown"
          icon="🔍"
          label="Drill Down"
          description="Detailed member analysis"
        />
        <QuickActionButton
          href="?view=trends"
          icon="📈"
          label="View Trends"
          description="Historical patterns"
        />
      </div>

      {/* View-specific content */}
      {viewType === 'drilldown' && (
        <div style={{ padding: '16px', borderTop: '1px solid var(--theme-elevation-100)' }}>
          <h3 style={{ color: 'var(--theme-elevation-800)', marginBottom: 12 }}>
            Member Drill-down
          </h3>
          <div style={{ fontSize: 13, color: 'var(--theme-elevation-600)' }}>
            Select a specific member or squad above to view detailed attendance patterns, compliance
            history, and individual performance metrics.
          </div>
        </div>
      )}

      {viewType === 'trends' && (
        <div style={{ padding: '16px', borderTop: '1px solid var(--theme-elevation-100)' }}>
          <h3 style={{ color: 'var(--theme-elevation-800)', marginBottom: 12 }}>Absence Trends</h3>
          <div style={{ fontSize: 13, color: 'var(--theme-elevation-600)' }}>
            Trend analysis shows attendance patterns over time. Use the period selector to adjust
            the time range for trend calculation.
          </div>
        </div>
      )}

      {viewType === 'export' && (
        <div style={{ padding: '16px', borderTop: '1px solid var(--theme-elevation-100)' }}>
          <h3 style={{ color: 'var(--theme-elevation-800)', marginBottom: 12 }}>
            Export & Automation
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--theme-elevation-600)' }}>
              Export current view as CSV, PDF, or Excel. Set up automated reports to HR.
            </div>
            <form style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="email"
                placeholder="HR email address"
                style={{
                  padding: '6px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--theme-elevation-200)',
                  fontSize: 13,
                }}
              />
              <select
                style={{
                  padding: '6px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--theme-elevation-200)',
                  fontSize: 13,
                }}
              >
                <option>Weekly</option>
                <option>End of Sprint</option>
                <option>Monthly</option>
              </select>
              <button
                type="button"
                style={{
                  padding: '6px 12px',
                  borderRadius: 4,
                  border: '1px solid var(--theme-success-700)',
                  background: 'var(--theme-success-600)',
                  color: 'white',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Setup Auto-Email
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon,
  color,
}: {
  title: string
  value: string | number
  icon: string
  color: string
}) {
  return (
    <div
      style={{
        padding: '12px',
        background: 'var(--theme-elevation-50)',
        border: '1px solid var(--theme-elevation-200)',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--theme-elevation-600)', marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color }}>{value}</div>
      </div>
    </div>
  )
}

function QuickActionButton({
  href,
  icon,
  label,
  description,
}: {
  href: string
  icon: string
  label: string
  description: string
}) {
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: 'var(--theme-elevation-50)',
        border: '1px solid var(--theme-elevation-200)',
        borderRadius: 6,
        textDecoration: 'none',
        color: 'var(--theme-elevation-800)',
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--theme-elevation-600)' }}>{description}</div>
      </div>
    </a>
  )
}
