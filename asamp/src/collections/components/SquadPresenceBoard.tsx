import type { Payload } from 'payload'
import type { AttendanceLog, Squad as SquadType, User as UserType } from '@/payload-types'

type AdminUser = Pick<UserType, 'id' | 'squad' | 'workMode' | 'role'>
const WORK_MODES = ['remote', 'office', 'client-site', 'ooo'] as const
type WorkMode = (typeof WORK_MODES)[number]

function getTodayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function SquadPresenceBoard({
  payload,
  searchParams,
  user,
}: {
  payload: Payload
  searchParams: { [key: string]: string | undefined }
  user?: AdminUser
}) {
  // Only admins, squad leads, members, and viewers can view the presence board
  if (!user) {
    return null
  }
  // Fetch squads for selector - respects collection access rules
  // Admins/viewers see all, squad leads see squads they're involved with, members see only their squad
  const squadsRes = await payload.find({
    collection: 'squads',
    limit: 100,
    user,
  })
  const squads = squadsRes.docs as SquadType[]

  if (squads.length === 0) {
    return (
      <div style={{ padding: 12, border: '1px solid var(--theme-elevation-200)', borderRadius: 8 }}>
        <span style={{ color: 'var(--theme-elevation-700)', fontSize: 13 }}>No squads found.</span>
      </div>
    )
  }

  const userSquadId =
    typeof user?.squad === 'object' ? (user?.squad as any)?.id : (user?.squad as string | undefined)
  const selectedFromQuery = searchParams.squad
  // Restrict selection to allowed squads for squadLead
  const allowedSquadIDs = new Set(squads.map((s) => s.id))
  const fallback = userSquadId && allowedSquadIDs.has(userSquadId) ? userSquadId : squads[0].id
  const selectedSquad =
    selectedFromQuery && allowedSquadIDs.has(selectedFromQuery) ? selectedFromQuery : fallback

  // Fetch users in selected squad
  const usersRes = await payload.find({
    collection: 'users',
    where: { squad: { equals: selectedSquad } },
    limit: 200,
    user,
  })
  const members = usersRes.docs as UserType[]

  const { start, end } = getTodayRange()
  let todaysLogs: AttendanceLog[] = []

  if (members.length > 0) {
    const memberIds = members.map((m) => m.id)
    const logsRes = await payload.find({
      collection: 'attendanceLogs',
      where: {
        and: [
          { user: { in: memberIds } },
          { date: { greater_than_equal: start } },
          { date: { less_than: end } },
        ],
      },
      limit: 500,
      user,
    })
    todaysLogs = logsRes.docs as AttendanceLog[]
  }

  const logsByUser = new Map<string, AttendanceLog>()
  for (const log of todaysLogs) {
    const uid = typeof log.user === 'object' ? (log.user as any).id : (log.user as string)
    if (!logsByUser.has(uid)) logsByUser.set(uid, log)
  }

  const modeLabel: Record<WorkMode, string> = {
    remote: 'Remote',
    office: 'Office',
    'client-site': 'Client Site',
    ooo: 'Out of Office',
  }

  return (
    <div
      style={{
        margin: '12px 0 8px 0',
        padding: '12px 16px',
        background: 'var(--theme-elevation-0)',
        borderRadius: 8,
        border: '1px solid var(--theme-elevation-200)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--theme-elevation-800)' }}>Presence</strong>
        <form method="GET" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ color: 'var(--theme-elevation-600)' }}>Squad</span>
            <select
              name="squad"
              defaultValue={selectedSquad}
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--theme-elevation-200)',
                background: 'var(--theme-elevation-0)',
                color: 'var(--theme-elevation-800)',
                fontSize: 13,
              }}
            >
              {squads.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              border: '1px solid var(--theme-elevation-300)',
              background: 'var(--theme-elevation-50)',
              color: 'var(--theme-elevation-800)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            View
          </button>
        </form>
      </div>

      <div style={{ marginTop: 10, display: 'grid', gap: 8, gridTemplateColumns: '1fr' }}>
        {members.length === 0 && (
          <div
            style={{
              padding: '8px 10px',
              border: '1px solid var(--theme-elevation-200)',
              background: 'var(--theme-elevation-50)',
              color: 'var(--theme-elevation-700)',
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            No members in this squad.
          </div>
        )}

        {members.map((m) => {
          const log = logsByUser.get(m.id)
          const checkedIn = !!(log && log.checkInTime && !log.checkOutTime)
          const effectiveMode = (log?.workMode || m.workMode) as WorkMode

          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                border: '1px solid var(--theme-elevation-200)',
                background: 'var(--theme-elevation-50)',
                borderRadius: 6,
              }}
            >
              <div
                title={checkedIn ? 'Checked in' : 'Not checked in'}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: checkedIn ? 'var(--theme-success-600)' : 'var(--theme-error-600)',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
                <span
                  style={{ color: 'var(--theme-elevation-800)', fontWeight: 500, fontSize: 13 }}
                >
                  {m.name || m.email}
                </span>
                <span style={{ color: 'var(--theme-elevation-500)', fontSize: 12 }}>{m.email}</span>
              </div>
              <div
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--theme-elevation-0)',
                  border: '1px solid var(--theme-elevation-200)',
                  color: 'var(--theme-elevation-800)',
                  borderRadius: 999,
                  padding: '4px 8px',
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background:
                      effectiveMode === 'remote'
                        ? 'var(--theme-success-600)'
                        : effectiveMode === 'office'
                          ? 'var(--theme-accent-600, #3b82f6)'
                          : effectiveMode === 'client-site'
                            ? 'var(--theme-warning-600, #f59e0b)'
                            : 'var(--theme-elevation-500)',
                  }}
                />
                <span>{modeLabel[effectiveMode]}</span>
                {log?.checkInTime && (
                  <span style={{ color: 'var(--theme-elevation-600)' }}>
                    In {new Date(log.checkInTime).toLocaleTimeString()}
                  </span>
                )}
                {log?.checkOutTime && (
                  <span style={{ color: 'var(--theme-elevation-600)' }}>
                    Out {new Date(log.checkOutTime).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
