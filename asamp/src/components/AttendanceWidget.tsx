'use client'

import React, { useState, useEffect } from 'react'
import './attendance-widget.css'

interface AttendanceStatus {
  hasCheckedIn: boolean
  hasCheckedOut: boolean
  attendance: {
    checkInTime?: string
    checkOutTime?: string
    workMode?: string
  } | null
}

export default function AttendanceWidget() {
  const [status, setStatus] = useState<AttendanceStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [workMode, setWorkMode] = useState('remote')
  const [location, setLocation] = useState<string | null>(null)

  useEffect(() => {
    fetchStatus()

    // Request geolocation permission
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation(`${position.coords.latitude},${position.coords.longitude}`)
        },
        (error) => {
          console.log('Geolocation not available:', error)
        },
      )
    }
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/attendance/status')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Error fetching status:', error)
    }
  }

  const handleCheckIn = async () => {
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workMode,
          location,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(data.message)
        await fetchStatus()
      } else {
        setMessage(data.error)
      }
    } catch (error) {
      setMessage('Failed to check in')
      console.error('Check-in error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckOut = async () => {
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(data.message)
        await fetchStatus()
      } else {
        setMessage(data.error)
      }
    } catch (error) {
      setMessage('Failed to check out')
      console.error('Check-out error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!status) {
    return <div className="attendance-widget loading">Loading...</div>
  }

  return (
    <div className="attendance-widget">
      <h2>Daily Attendance</h2>

      {message && (
        <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="status-info">
        {status.hasCheckedIn ? (
          <>
            <p className="status checked-in">
              ✓ Checked in at{' '}
              {status.attendance?.checkInTime &&
                new Date(status.attendance.checkInTime).toLocaleTimeString()}
            </p>
            {status.hasCheckedOut && (
              <p className="status checked-out">
                ✓ Checked out at{' '}
                {status.attendance?.checkOutTime &&
                  new Date(status.attendance.checkOutTime).toLocaleTimeString()}
              </p>
            )}
          </>
        ) : (
          <p className="status not-checked-in">Not checked in today</p>
        )}
      </div>

      {!status.hasCheckedIn && (
        <div className="check-in-form">
          <label htmlFor="workMode">Work Mode:</label>
          <select
            id="workMode"
            value={workMode}
            onChange={(e) => setWorkMode(e.target.value)}
            disabled={loading}
          >
            <option value="remote">Remote</option>
            <option value="office">Office</option>
            <option value="client-site">Client Site</option>
            <option value="ooo">Out of Office</option>
          </select>

          <button className="btn btn-check-in" onClick={handleCheckIn} disabled={loading}>
            {loading ? 'Checking in...' : 'Check In'}
          </button>
        </div>
      )}

      {status.hasCheckedIn && !status.hasCheckedOut && (
        <button className="btn btn-check-out" onClick={handleCheckOut} disabled={loading}>
          {loading ? 'Checking out...' : 'Check Out'}
        </button>
      )}

      {location && <p className="location-info">📍 Location tracking enabled</p>}
    </div>
  )
}
