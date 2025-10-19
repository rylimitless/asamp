import type { Payload } from 'payload'
import type { AttendanceLog, User as UserType } from '@/payload-types'

type AdminUser = Pick<UserType, 'id' | 'squad' | 'workMode'>
const WORK_MODES = ['remote', 'office', 'client-site', 'ooo'] as const
type WorkMode = (typeof WORK_MODES)[number]

async function getTodaysAttendance(payload: Payload, userId: string, user?: AdminUser) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const attendanceLogs = await payload.find({
    collection: 'attendanceLogs',
    where: {
      and: [
        {
          user: { equals: userId },
        },
        {
          date: {
            greater_than_equal: today.toISOString(),
          },
        },
        {
          date: {
            less_than: tomorrow.toISOString(),
          },
        },
      ],
    },
    limit: 1,
    user,
  })

  return attendanceLogs.docs[0] || null
}

async function getActiveSprint(payload: Payload, squadId: string, user?: AdminUser) {
  if (!squadId) return null

  try {
    const sprints = await payload.find({
      collection: 'sprints',
      where: {
        and: [{ squad: { equals: squadId } }, { isActive: { equals: true } }],
      },
      limit: 1,
      user,
    })
    return sprints.docs[0] || null
  } catch (error) {
    console.error('Error fetching active sprint:', error)
    return null
  }
}

async function handleCheckIn(
  payload: Payload,
  userId: string,
  workMode: WorkMode,
  currentUser?: AdminUser,
) {
  try {
    const user = await payload.findByID({ collection: 'users', id: userId, user: currentUser })
    if (!user) {
      throw new Error('User not found')
    }

    // Normalize squad ID
    const squadId =
      (user as any)?.squad && typeof (user as any).squad === 'object'
        ? (user as any).squad.id
        : (user as any)?.squad

    if (!squadId) {
      throw new Error('User must be assigned to a squad')
    }

    // Get active sprint for auto-linking
    const activeSprint = await getActiveSprint(payload, squadId, currentUser)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const now = new Date()

    const existingLog = await getTodaysAttendance(payload, userId, currentUser)

    const checkInData = {
      user: userId,
      squad: squadId,
      sprint: activeSprint?.id || null, // Auto-link to active sprint if available
      date: today.toISOString(),
      checkInTime: now.toISOString(),
      workMode: workMode as AttendanceLog['workMode'],
      location: 'Web Admin',
      verified: true,
    }

    if (existingLog) {
      return await payload.update({
        collection: 'attendanceLogs',
        id: existingLog.id,
        data: checkInData,
        user: currentUser,
      })
    } else {
      return await payload.create({
        collection: 'attendanceLogs',
        data: checkInData,
        user: currentUser,
      })
    }
  } catch (error) {
    console.error('Check-in error:', error)
    throw error
  }
}

async function handleCheckOut(payload: Payload, userId: string, currentUser?: AdminUser) {
  try {
    const existingLog = await getTodaysAttendance(payload, userId, currentUser)

    if (!existingLog || !existingLog.checkInTime) {
      throw new Error('No check-in found for today')
    }

    const now = new Date()

    return await payload.update({
      collection: 'attendanceLogs',
      id: existingLog.id,
      data: {
        checkOutTime: now.toISOString(),
      },
      user: currentUser,
    })
  } catch (error) {
    console.error('Check-out error:', error)
    throw error
  }
}

export async function AttendanceButtons({
  payload,
  searchParams,
  user,
}: {
  payload: Payload
  searchParams: { [key: string]: string | undefined }
  user?: AdminUser
}) {
  const currentUserId = user?.id

  const action = searchParams.action
  const rawWorkMode = searchParams.workMode
  const workMode: WorkMode = WORK_MODES.includes(rawWorkMode as WorkMode)
    ? (rawWorkMode as WorkMode)
    : 'remote'

  let message = ''
  let todaysLog: AttendanceLog | null = null

  if (currentUserId) {
    // Handle form submissions
    if (action === 'checkin' && workMode) {
      try {
        await handleCheckIn(payload, currentUserId, workMode, user)
        message = 'Successfully checked in!'
      } catch (error) {
        message = `Error checking in: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error('Check-in failed:', error)
      }
    } else if (action === 'checkout') {
      try {
        await handleCheckOut(payload, currentUserId, user)
        message = 'Successfully checked out!'
      } catch (error) {
        message = `Error checking out: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error('Check-out failed:', error)
      }
    }

    // Get current status
    try {
      todaysLog = await getTodaysAttendance(payload, currentUserId, user)
    } catch (error) {
      console.error("Error fetching today's log:", error)
    }
  }

  const isCheckedIn = !!(todaysLog && todaysLog.checkInTime && !todaysLog.checkOutTime)

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
      {!currentUserId && (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 12px',
            borderRadius: 4,
            background: 'var(--theme-error-100)',
            color: 'var(--theme-error-700)',
            border: '1px solid var(--theme-error-200)',
            fontSize: 13,
          }}
        >
          You must be logged in to take attendance.
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: isCheckedIn ? 'var(--theme-success-600)' : 'var(--theme-error-600)',
            }}
          />
          <span style={{ color: 'var(--theme-elevation-800)', fontWeight: 500, fontSize: 13 }}>
            {isCheckedIn && todaysLog
              ? `Checked in ${new Date(todaysLog.checkInTime).toLocaleTimeString()}`
              : 'Not checked in today'}
          </span>
        </div>

        {/* Action */}
        {currentUserId && !isCheckedIn ? (
          <form method="GET" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="hidden" name="action" value="checkin" />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--theme-elevation-500)' }}>Work Mode</span>
              <select
                name="workMode"
                defaultValue={workMode}
                style={{
                  padding: '6px 8px',
                  borderRadius: 3,
                  border: '1px solid var(--theme-elevation-200)',
                  background: 'var(--theme-elevation-0)',
                  color: 'var(--theme-elevation-800)',
                  fontSize: 13,
                }}
              >
                <option value="remote">Remote</option>
                <option value="office">Office</option>
                <option value="client-site">Client Site</option>
                <option value="ooo">Out of Office</option>
              </select>
            </label>
            <button
              type="submit"
              style={{
                padding: '8px 14px',
                borderRadius: 3,
                border: '1px solid var(--theme-success-700)',
                background: 'var(--theme-success-600)',
                color: 'var(--theme-elevation-0)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Check In
            </button>
          </form>
        ) : currentUserId ? (
          <form method="GET" style={{ display: 'flex', alignItems: 'center' }}>
            <input type="hidden" name="action" value="checkout" />
            <button
              type="submit"
              style={{
                padding: '8px 14px',
                borderRadius: 3,
                border: '1px solid var(--theme-error-700)',
                background: 'var(--theme-error-600)',
                color: 'var(--theme-elevation-0)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Check Out
            </button>
          </form>
        ) : null}

        {/* Today's short summary */}
        {todaysLog && (
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--theme-elevation-50)',
              color: 'var(--theme-elevation-700)',
              border: '1px solid var(--theme-elevation-200)',
              borderRadius: 4,
              padding: '6px 10px',
              fontSize: 12,
            }}
          >
            <strong style={{ color: 'var(--theme-elevation-800)', fontWeight: 600 }}>Today:</strong>
            <span>Mode: {todaysLog.workMode}</span>
            <span>In: {new Date(todaysLog.checkInTime).toLocaleTimeString()}</span>
            {todaysLog.checkOutTime && (
              <span>Out: {new Date(todaysLog.checkOutTime).toLocaleTimeString()}</span>
            )}
            {todaysLog.sprint && (
              <span style={{ color: 'var(--theme-elevation-600)' }}>Sprint linked</span>
            )}
          </div>
        )}
      </div>

      {/* Inline feedback under row */}
      {message && (
        <div
          style={{
            marginTop: 10,
            padding: '6px 10px',
            borderRadius: 4,
            background: message.includes('Error')
              ? 'var(--theme-error-100)'
              : 'var(--theme-success-100)',
            color: message.includes('Error')
              ? 'var(--theme-error-700)'
              : 'var(--theme-success-700)',
            border: message.includes('Error')
              ? '1px solid var(--theme-error-200)'
              : '1px solid var(--theme-success-200)',
            fontSize: 12,
            display: 'inline-block',
          }}
        >
          {message}
        </div>
      )}
    </div>
  )
}
