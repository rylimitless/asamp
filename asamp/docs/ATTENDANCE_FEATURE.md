# Attendance Check-in/Check-out Feature

## Overview

This feature provides web-based check-in and check-out functionality with:
- Quick button interface for daily attendance
- Optional geolocation tracking (requires browser permission)
- IP address logging for location verification
- Auto-checkout reminders at end of workday
- Real-time status updates

## Components

### API Endpoints

1. **POST `/api/attendance/check-in`**
   - Creates a new attendance log for the current user
   - Requires authentication
   - Accepts: `{ workMode: string, location?: string }`
   - Returns: Attendance log with check-in time

2. **POST `/api/attendance/check-out`**
   - Updates today's attendance log with check-out time
   - Requires authentication
   - Accepts: `{ location?: string }`
   - Returns: Updated attendance log

3. **GET `/api/attendance/status`**
   - Returns current user's attendance status for today
   - Shows if checked in/out and attendance details

4. **POST `/api/attendance/auto-checkout-reminder`**
   - Sends reminders to users who haven't checked out
   - Protected by CRON_SECRET environment variable
   - Designed to be called by a cron job

### Frontend Component

**`AttendanceWidget`** - Client-side React component that:
- Shows current attendance status
- Provides check-in button with work mode selection
- Provides check-out button when checked in
- Requests geolocation permission (optional)
- Displays success/error messages

## Setup

### 1. Environment Variables

Add to your `.env` file:

```bash
# Secret for protecting cron endpoints
CRON_SECRET=your-random-secret-key-here
```

### 2. Auto-Checkout Reminders

Set up a cron job to send reminders at end of workday (e.g., 5:30 PM):

#### Using cron (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Add this line (runs at 5:30 PM daily)
30 17 * * * curl -X POST https://your-domain.com/api/attendance/auto-checkout-reminder -H "Authorization: Bearer YOUR_CRON_SECRET"
```

#### Using Vercel Cron Jobs

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/attendance/auto-checkout-reminder",
      "schedule": "30 17 * * *"
    }
  ]
}
```

Then update the endpoint to check for Vercel's authentication:

```typescript
const authHeader = request.headers.get('authorization')
const isVercelCron = request.headers.get('x-vercel-cron-secret') === process.env.CRON_SECRET

if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

#### Using GitHub Actions

Create `.github/workflows/checkout-reminder.yml`:

```yaml
name: Auto Checkout Reminder

on:
  schedule:
    # Runs at 5:30 PM UTC daily
    - cron: '30 17 * * *'
  workflow_dispatch: # Allows manual trigger

jobs:
  send-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Send checkout reminders
        run: |
          curl -X POST https://your-domain.com/api/attendance/auto-checkout-reminder \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### 3. Geolocation Setup

The widget automatically requests geolocation permission from the user's browser. No server configuration needed, but users must grant permission.

To test geolocation:
1. Open your site in a browser
2. When prompted, click "Allow" for location access
3. Check-in will include coordinates in the location field

### 4. IP Logging

IP addresses are automatically captured from request headers:
- Checks `x-forwarded-for` (for proxies/load balancers)
- Falls back to `x-real-ip`
- Uses 'unknown' if neither is available

For production, ensure your reverse proxy (Nginx, Cloudflare, etc.) properly sets these headers.

## Usage

### For Users

1. **Check In**:
   - Go to the home page
   - Select your work mode (Remote, Office, Client Site, Out of Office)
   - Click "Check In"
   - Optionally allow location access

2. **Check Out**:
   - Return to the home page
   - Click "Check Out"

3. **View Status**:
   - Your current check-in/out status is always visible on the home page

### For Admins

View all attendance logs in the Payload admin panel:
- Go to `/admin/collections/attendanceLogs`
- Filter by user, squad, date, or work mode
- See location data and verification status
- Add notes or flags to records

## Features to Add

- [ ] Mobile app integration
- [ ] Face recognition check-in
- [ ] Bluetooth beacon detection for office check-ins
- [ ] Weekly attendance reports
- [ ] Integration with calendar for automatic leave detection
- [ ] Push notifications for reminders
- [ ] Offline check-in with sync when online

## Troubleshooting

**Geolocation not working**:
- Ensure site is served over HTTPS (required for geolocation API)
- Check browser permissions
- Test in different browsers

**IP shows as 'unknown'**:
- Check reverse proxy configuration
- Verify headers are being passed through

**Cron job not running**:
- Verify CRON_SECRET is set correctly
- Check cron job logs
- Test endpoint manually with curl

**Already checked in error**:
- System prevents duplicate check-ins on same day
- Admins can manually edit attendance logs if needed
