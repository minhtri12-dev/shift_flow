import {
  getShiftInterval,
  doIntervalsOverlap,
  type ShiftTimeDefinition,
  type AssignmentForConflictCheck,
  type TimeInterval,
} from './scheduleConflict'

export type LeaveRequestRecord = {
  id: number
  employee_id?: number | null
  employeeId?: number | null
  name?: string
  status?: string | null
  start_date?: string | null
  end_date?: string | null
  date_range?: string | null
  days_count?: string | null
}

export type SchedulePolicyConfig = {
  maxDailyHours?: number | null
  maxWeeklyHours?: number | null
  minRestHours?: number | null
  blockOnOvertime?: boolean
  blockOnRestViolation?: boolean
}

export function getLeaveInterval(leave: LeaveRequestRecord): TimeInterval | null {
  let startDate = leave.start_date || ''
  let endDate = leave.end_date || leave.start_date || ''

  if (!startDate && leave.date_range) {
    const raw = leave.date_range.trim()
    const parts = raw.split(/[–\-]/).map((p) => p.trim())
    const parsePartToIso = (part: string) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part
      const m = part.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/)
      if (m && m[3]) {
        return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
      }
      return null
    }

    startDate = parsePartToIso(parts[0]) || ''
    endDate = parts[1] ? parsePartToIso(parts[1]) || startDate : startDate
  }

  if (!startDate) return null
  if (!endDate) endDate = startDate

  const startInterval = getShiftInterval(startDate, '00:00', '00:00')
  const endInterval = getShiftInterval(endDate, '23:59', '23:59')

  return {
    startMinutes: startInterval.startMinutes,
    endMinutes: endInterval.endMinutes,
  }
}

export function checkLeaveConflict(params: {
  employeeId: number
  targetDate: string
  targetShift: ShiftTimeDefinition
  leaveRequests: LeaveRequestRecord[]
}): {
  hasConflict: boolean
  conflictingLeave?: LeaveRequestRecord
  reason?: string
} {
  const { employeeId, targetDate, targetShift, leaveRequests } = params

  if (!Array.isArray(leaveRequests)) {
    throw new Error('Dữ liệu đơn nghỉ phép không hợp lệ hoặc truy vấn thất bại.')
  }

  const shiftInterval = getShiftInterval(targetDate, targetShift.start, targetShift.end)

  const approvedLeaves = leaveRequests.filter((l) => {
    const empId = Number(l.employee_id ?? l.employeeId)
    if (empId !== employeeId) return false
    return String(l.status || '').trim().toLowerCase() === 'đã duyệt'
  })

  for (const leave of approvedLeaves) {
    const leaveInterval = getLeaveInterval(leave)
    if (!leaveInterval) continue

    if (doIntervalsOverlap(shiftInterval, leaveInterval)) {
      return {
        hasConflict: true,
        conflictingLeave: leave,
        reason: `Nhân viên có đơn nghỉ phép đã duyệt (${leave.date_range || `${leave.start_date} –${leave.end_date}`}).`,
      }
    }
  }

  return { hasConflict: false }
}

export function calculateAndCheckWorkHours(params: {
  employeeId: number
  targetDate: string
  targetShift: ShiftTimeDefinition
  existingAssignments: AssignmentForConflictCheck[]
  shiftDefinitions: Map<number, ShiftTimeDefinition>
  excludeAssignmentId?: number
  policy?: SchedulePolicyConfig
}): {
  dailyHours: number
  weeklyHours: number
  dailyLimitExceeded: boolean
  weeklyLimitExceeded: boolean
  warnings: string[]
  blockingErrors: string[]
} {
  const {
    employeeId,
    targetDate,
    targetShift,
    existingAssignments,
    shiftDefinitions,
    excludeAssignmentId,
    policy = {},
  } = params

  const targetInterval = getShiftInterval(targetDate, targetShift.start, targetShift.end)
  const targetShiftMinutes = targetInterval.endMinutes - targetInterval.startMinutes

  const parts = targetDate.split('-').map(Number)
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  const dayOfWeek = dt.getUTCDay()
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const mondayDt = new Date(dt)
  mondayDt.setUTCDate(dt.getUTCDate() + diffToMonday)
  const sundayDt = new Date(mondayDt)
  sundayDt.setUTCDate(mondayDt.getUTCDate() + 6)

  const mondayIso = mondayDt.toISOString().slice(0, 10)
  const sundayIso = sundayDt.toISOString().slice(0, 10)

  const validAssignments = existingAssignments.filter((a) => {
    if (a.employeeId !== employeeId) return false
    if (excludeAssignmentId && a.id === excludeAssignmentId) return false
    if (a.status === 'Đã hủy') return false
    return true
  })

  let dayMinutes = targetShiftMinutes
  for (const a of validAssignments) {
    if (a.workDate === targetDate) {
      const s = shiftDefinitions.get(a.shiftId)
      if (s) {
        const interval = getShiftInterval(a.workDate, s.start, s.end)
        dayMinutes += interval.endMinutes - interval.startMinutes
      }
    }
  }

  let weekMinutes = targetShiftMinutes
  for (const a of validAssignments) {
    if (a.workDate >= mondayIso && a.workDate <= sundayIso) {
      const s = shiftDefinitions.get(a.shiftId)
      if (s) {
        const interval = getShiftInterval(a.workDate, s.start, s.end)
        weekMinutes += interval.endMinutes - interval.startMinutes
      }
    }
  }

  const dailyHours = Number((dayMinutes / 60).toFixed(1))
  const weeklyHours = Number((weekMinutes / 60).toFixed(1))

  const maxDaily = policy.maxDailyHours ?? null
  const maxWeekly = policy.maxWeeklyHours ?? null
  const blockOnOvertime = Boolean(policy.blockOnOvertime)

  const dailyLimitExceeded = Boolean(maxDaily && dailyHours > maxDaily)
  const weeklyLimitExceeded = Boolean(maxWeekly && weeklyHours > maxWeekly)

  const warnings: string[] = []
  const blockingErrors: string[] = []

  if (dailyLimitExceeded) {
    const msg = `Tổng giờ làm trong ngày (${dailyHours}h) vượt quá mức quy định (${maxDaily}h).`
    if (blockOnOvertime) blockingErrors.push(msg)
    else warnings.push(msg)
  }

  if (weeklyLimitExceeded) {
    const msg = `Tổng giờ làm trong tuần (${weeklyHours}h) vượt quá hạn mức quy định (${maxWeekly}h).`
    if (blockOnOvertime) blockingErrors.push(msg)
    else warnings.push(msg)
  }

  return {
    dailyHours,
    weeklyHours,
    dailyLimitExceeded,
    weeklyLimitExceeded,
    warnings,
    blockingErrors,
  }
}

export function checkMinRestBetweenShifts(params: {
  employeeId: number
  targetDate: string
  targetShift: ShiftTimeDefinition
  existingAssignments: AssignmentForConflictCheck[]
  shiftDefinitions: Map<number, ShiftTimeDefinition>
  excludeAssignmentId?: number
  policy?: SchedulePolicyConfig
}): {
  violatesMinRest: boolean
  actualRestHours?: number
  requiredRestHours?: number
  relatedShiftName?: string
  message?: string
  isBlocking: boolean
} {
  const {
    employeeId,
    targetDate,
    targetShift,
    existingAssignments,
    shiftDefinitions,
    excludeAssignmentId,
    policy = {},
  } = params

  const minRestHours = policy.minRestHours ?? null
  if (!minRestHours || minRestHours <= 0) {
    return { violatesMinRest: false, isBlocking: false }
  }

  const minRestMinutes = minRestHours * 60
  const targetInterval = getShiftInterval(targetDate, targetShift.start, targetShift.end)

  const otherAssignments = existingAssignments.filter((a) => {
    if (a.employeeId !== employeeId) return false
    if (excludeAssignmentId && a.id === excludeAssignmentId) return false
    if (a.status === 'Đã hủy') return false
    return true
  })

  let shortestRestMinutes = Number.POSITIVE_INFINITY
  let offendingShiftName = ''
  let offendingDetails = ''

  for (const a of otherAssignments) {
    const s = shiftDefinitions.get(a.shiftId)
    if (!s) continue

    const interval = getShiftInterval(a.workDate, s.start, s.end)

    if (interval.endMinutes <= targetInterval.startMinutes) {
      const rest = targetInterval.startMinutes - interval.endMinutes
      if (rest < shortestRestMinutes) {
        shortestRestMinutes = rest
        offendingShiftName = s.name
        offendingDetails = `nghỉ sau ca "${s.name}" ngày ${a.workDate}`
      }
    }

    if (targetInterval.endMinutes <= interval.startMinutes) {
      const rest = interval.startMinutes - targetInterval.endMinutes
      if (rest < shortestRestMinutes) {
        shortestRestMinutes = rest
        offendingShiftName = s.name
        offendingDetails = `nghỉ trước ca "${s.name}" ngày ${a.workDate}`
      }
    }
  }

  if (Number.isFinite(shortestRestMinutes) && shortestRestMinutes < minRestMinutes) {
    const actualRestHours = Number((shortestRestMinutes / 60).toFixed(1))
    const isBlocking = Boolean(policy.blockOnRestViolation)
    const message = `Thời gian ${offendingDetails} chỉ đạt ${actualRestHours}h, chưa đáp ứng mức tối thiểu cấu hình (${minRestHours}h).`

    return {
      violatesMinRest: true,
      actualRestHours,
      requiredRestHours: minRestHours,
      relatedShiftName: offendingShiftName,
      message,
      isBlocking,
    }
  }

  return { violatesMinRest: false, isBlocking: false }
}