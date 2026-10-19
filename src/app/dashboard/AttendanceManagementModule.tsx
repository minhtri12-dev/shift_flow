'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  ScheduleEmployeeItem,
  ScheduleShiftItem,
  ShiftAssignment,
} from './WeeklyScheduleModule'

export type AttendanceItem = {
  id: number
  employeeId: number | null
  shiftId: number | null
  name: string
  initials: string
  department: string
  shift: string
  workDate: string
  checkIn: string
  checkOut: string | null
  breakMinutes: number
  totalMinutes: number
  totalHours: string
  status: string
  tone: string
  createdAt?: string
}

type AttendanceManagementProps = {
  attendanceLogs: AttendanceItem[]
  employees: ScheduleEmployeeItem[]
  shifts: ScheduleShiftItem[]
  departments: string[]
  assignments: ShiftAssignment[]
  todayIso: string
  maxLateMinutes: number
  isLoading: boolean
  isAdmin: boolean
  onRefresh: () => Promise<void>
  onNotify: (msg: string) => void
  onOpenCheckInModal: () => void
  onOpenCheckOutModal: (log: AttendanceItem) => void
  onExportCsv: () => void
}

function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr.trim())) return null
  const [h, m] = timeStr.trim().split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null
  }
  return h * 60 + m
}

function formatMinutesToHoursText(totalMinutes: number): string {
  const safeMins = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(safeMins / 60)
  const mins = safeMins % 60
  return `${hours}h ${String(mins).padStart(2, '0')}m`
}

function formatShortDate(isoDate: string): string {
  if (!isoDate) return '--/--'
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  return `${parts[2]}/${parts[1]}`
}

function formatFullVNDate(isoDate: string): string {
  if (!isoDate) return '--/--/----'
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function addDaysToIso(isoDate: string, days: number): string {
  const parts = isoDate.split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

function computeWorkedMinutes(
  checkIn: string,
  checkOut: string,
  breakMinutes = 0,
  allowOvernight = false,
): { valid: boolean; totalMinutes: number; error?: string } {
  const inMins = parseTimeToMinutes(checkIn)
  const outMins = parseTimeToMinutes(checkOut)

  if (inMins === null || outMins === null) {
    return { valid: false, totalMinutes: 0, error: 'Định dạng giờ không hợp lệ (HH:MM).' }
  }

  let rawDiff = outMins - inMins
  if (rawDiff < 0 && allowOvernight) {
    rawDiff += 24 * 60
  }

  if (rawDiff <= 0) {
    return {
      valid: false,
      totalMinutes: 0,
      error:
        'Giờ tan ca phải sau giờ vào ca (nếu là ca qua đêm, vui lòng bật tùy chọn Ca qua ngày hôm sau).',
    }
  }

  if (breakMinutes < 0 || breakMinutes >= rawDiff) {
    return {
      valid: false,
      totalMinutes: 0,
      error: 'Thời gian nghỉ giữa giờ phải nhỏ hơn tổng thời gian ca làm việc.',
    }
  }

  return {
    valid: true,
    totalMinutes: rawDiff - breakMinutes,
  }
}

export default function AttendanceManagementModule({
  attendanceLogs,
  employees,
  shifts,
  departments,
  assignments,
  todayIso,
  maxLateMinutes,
  isLoading,
  isAdmin,
  onRefresh,
  onNotify,
  onOpenCheckInModal,
  onOpenCheckOutModal,
  onExportCsv,
}: AttendanceManagementProps) {
  // Chế độ xem: 'logs' (Nhật ký chấm công) | 'reconcile' (Đối chiếu với lịch phân công)
  const [subTab, setSubTab] = useState<'logs' | 'reconcile'>('logs')

  // Bộ lọc ngày & khoảng thời gian
  const [dateScope, setDateScope] = useState<'day' | 'all'>('day')
  const [selectedDate, setSelectedDate] = useState<string>('')

  // Bộ lọc tìm kiếm, phòng ban, trạng thái và bất thường
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [deptFilter, setDeptFilter] = useState<string>('Tất cả')
  const [statusFilter, setStatusFilter] = useState<string>('Tất cả')
  const [anomalyOnly, setAnomalyOnly] = useState<boolean>(false)

  // State cho Modal Chi tiết & Điều chỉnh bản ghi chấm công
  const [detailTarget, setDetailTarget] = useState<{
    record: AttendanceItem
    shiftName: string
    workDate: string
    checkIn: string
    checkOut: string
    breakMinutes: number
    status: string
    isOvernight: boolean
  } | null>(null)

  // State cho Modal Ghi nhận nhanh từ dòng lịch phân công
  const [quickRecordTarget, setQuickRecordTarget] = useState<{
    assignment: ShiftAssignment
    employee: ScheduleEmployeeItem
    shift: ScheduleShiftItem
    checkIn: string
    checkOut: string
    breakMinutes: number
    isAbsent: boolean
    isOvernight: boolean
  } | null>(null)

  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [modalError, setModalError] = useState<string>('')

  const detailDialogRef = useRef<HTMLDialogElement>(null)
  const quickDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (todayIso && !selectedDate) {
      setSelectedDate(todayIso)
    }
  }, [todayIso, selectedDate])

  useEffect(() => {
    if (detailTarget && detailDialogRef.current && !detailDialogRef.current.open) {
      setModalError('')
      detailDialogRef.current.showModal()
    }
  }, [detailTarget])

  useEffect(() => {
    if (quickRecordTarget && quickDialogRef.current && !quickDialogRef.current.open) {
      setModalError('')
      quickDialogRef.current.showModal()
    }
  }, [quickRecordTarget])

  const activeDate = selectedDate || todayIso

  const employeeMap = useMemo(() => {
    const map = new Map<number, ScheduleEmployeeItem>()
    for (const e of employees) map.set(e.id, e)
    return map
  }, [employees])

  const shiftByIdMap = useMemo(() => {
    const map = new Map<number, ScheduleShiftItem>()
    for (const s of shifts) map.set(s.id, s)
    return map
  }, [shifts])

  const shiftByNameMap = useMemo(() => {
    const map = new Map<string, ScheduleShiftItem>()
    for (const s of shifts) map.set(s.name.toLowerCase(), s)
    return map
  }, [shifts])

  /**
   * Đối chiếu 1 bản ghi chấm công với Lịch phân công & Khung giờ chuẩn của ca
   */
  function analyzeAttendanceRecord(log: AttendanceItem) {
    const emp =
      (log.employeeId ? employeeMap.get(log.employeeId) : undefined) ||
      employees.find((e) => e.name.toLowerCase() === log.name.toLowerCase())

    const matchedShift =
      (log.shiftId ? shiftByIdMap.get(log.shiftId) : undefined) ||
      shiftByNameMap.get(log.shift.toLowerCase())

    // Tìm phân công lịch trong ngày của nhân viên này
    const dayAssignments = assignments.filter(
      (a) =>
        a.workDate === log.workDate &&
        a.status !== 'Đã hủy' &&
        (a.employeeId === log.employeeId || (emp && a.employeeId === emp.id)),
    )

    const exactScheduledAssignment = dayAssignments.find(
      (a) =>
        (log.shiftId && a.shiftId === log.shiftId) ||
        shiftByIdMap.get(a.shiftId)?.name.toLowerCase() === log.shift.toLowerCase(),
    )

    const isUnscheduled = dayAssignments.length === 0
    const isDifferentShiftFromSchedule =
      dayAssignments.length > 0 && !exactScheduledAssignment

    // Tính chênh lệch giờ vào (Check-in Variance) và giờ công (Duration Variance)
    let checkInDiffMinutes: number | null = null
    let checkInDiffLabel = 'Chưa đối chiếu'
    let checkInDiffTone: 'teal' | 'orange' | 'red' | 'slate' = 'slate'

    let scheduledMinutes: number | null = null
    let durationDiffMinutes: number | null = null

    if (matchedShift) {
      const sStart = parseTimeToMinutes(matchedShift.start)
      const sEnd = parseTimeToMinutes(matchedShift.end)
      if (sStart !== null && sEnd !== null) {
        scheduledMinutes = sEnd > sStart ? sEnd - sStart : sEnd + 24 * 60 - sStart
      }

      if (log.status === 'Vắng mặt') {
        checkInDiffLabel = 'Vắng mặt'
        checkInDiffTone = 'red'
      } else {
        const actualIn = parseTimeToMinutes(log.checkIn)
        if (sStart !== null && actualIn !== null) {
          checkInDiffMinutes = actualIn - sStart
          if (checkInDiffMinutes <= 0) {
            checkInDiffLabel =
              checkInDiffMinutes === 0
                ? 'Đúng giờ chuẩn'
                : `Sớm ${Math.abs(checkInDiffMinutes)}p`
            checkInDiffTone = 'teal'
          } else if (checkInDiffMinutes <= maxLateMinutes) {
            checkInDiffLabel = `+${checkInDiffMinutes}p (Trong ngưỡng)`
            checkInDiffTone = 'teal'
          } else {
            checkInDiffLabel = `Trễ ${checkInDiffMinutes}p`
            checkInDiffTone = 'orange'
          }
        }
      }

      if (scheduledMinutes !== null && log.checkOut && log.totalMinutes > 0) {
        durationDiffMinutes = log.totalMinutes - scheduledMinutes
      }
    }

    // Phát hiện bất thường:
    // 1. Ca từ ngày trước hôm nay mà vẫn chưa có giờ ra (Quên tan ca)
    const isStaleOpenShift =
      log.status !== 'Vắng mặt' &&
      log.checkOut === null &&
      Boolean(todayIso && log.workDate < todayIso)

    // 2. Đi trễ hoặc Vắng mặt hoặc Lệch ca phân công
    const hasAnomaly =
      isStaleOpenShift ||
      log.status === 'Đi trễ' ||
      log.status === 'Vắng mặt' ||
      isDifferentShiftFromSchedule

    return {
      empCode: emp?.code || (log.employeeId ? `SF-${String(log.employeeId).padStart(3, '0')}` : 'N/A'),
      empRole: emp?.role || '',
      matchedShift,
      scheduledWindow: matchedShift ? `${matchedShift.start} – ${matchedShift.end}` : 'Chưa rõ khung giờ',
      scheduledMinutes,
      exactScheduledAssignment,
      isUnscheduled,
      isDifferentShiftFromSchedule,
      checkInDiffMinutes,
      checkInDiffLabel,
      checkInDiffTone,
      durationDiffMinutes,
      isStaleOpenShift,
      hasAnomaly,
    }
  }

  // Thống kê tổng quan theo ngày đang xem (activeDate)
  const dailyMetrics = useMemo(() => {
    const dayAssignments = assignments.filter(
      (a) => a.workDate === activeDate && a.status !== 'Đã hủy',
    )
    const dayLogs = attendanceLogs.filter((l) => l.workDate === activeDate)

    const presentLogs = dayLogs.filter((l) => l.status !== 'Vắng mặt')
    const lateLogs = dayLogs.filter((l) => l.status === 'Đi trễ')
    const absentLogs = dayLogs.filter((l) => l.status === 'Vắng mặt')
    const completedLogs = presentLogs.filter((l) => l.checkOut !== null)
    const openLogs = presentLogs.filter((l) => l.checkOut === null)

    // Đếm số ca phân công trong ngày chưa có bản ghi chấm công
    let unrecordedScheduledCount = 0
    for (const assign of dayAssignments) {
      const emp = employeeMap.get(assign.employeeId)
      const shift = shiftByIdMap.get(assign.shiftId)
      const hasLog = dayLogs.some(
        (l) =>
          (l.employeeId === assign.employeeId ||
            (emp && l.name.toLowerCase() === emp.name.toLowerCase())) &&
          (l.shiftId === assign.shiftId ||
            (shift && l.shift.toLowerCase() === shift.name.toLowerCase())),
      )
      if (!hasLog) unrecordedScheduledCount += 1
    }

    // Đếm các ca quên checkout từ những ngày trước
    const staleOpenGlobalCount = attendanceLogs.filter(
      (l) => l.status !== 'Vắng mặt' && l.checkOut === null && todayIso && l.workDate < todayIso,
    ).length

    const needReviewCount =
      lateLogs.length + absentLogs.length + unrecordedScheduledCount + staleOpenGlobalCount

    return {
      scheduledCount: dayAssignments.length,
      checkedInCount: presentLogs.length,
      lateCount: lateLogs.length,
      absentCount: absentLogs.length,
      completedCount: completedLogs.length,
      openCount: openLogs.length,
      unrecordedScheduledCount,
      staleOpenGlobalCount,
      needReviewCount,
    }
  }, [assignments, attendanceLogs, activeDate, employeeMap, shiftByIdMap, todayIso])

  // Danh sách bản ghi chấm công đã lọc
  const filteredAttendanceList = useMemo(() => {
    return attendanceLogs
      .map((log) => ({
        log,
        meta: analyzeAttendanceRecord(log),
      }))
      .filter(({ log, meta }) => {
        if (dateScope === 'day' && activeDate && log.workDate !== activeDate) {
          return false
        }
        if (deptFilter !== 'Tất cả' && log.department !== deptFilter) {
          return false
        }
        if (statusFilter !== 'Tất cả') {
          if (statusFilter === 'Đang trong ca') {
            if (log.checkOut !== null || log.status === 'Vắng mặt') return false
          } else if (statusFilter === 'Đã hoàn tất') {
            if (log.checkOut === null || log.status === 'Vắng mặt') return false
          } else if (log.status !== statusFilter) {
            return false
          }
        }
        if (anomalyOnly && !meta.hasAnomaly) {
          return false
        }
        const q = searchQuery.trim().toLowerCase()
        if (q) {
          const matchName = log.name.toLowerCase().includes(q)
          const matchCode = meta.empCode.toLowerCase().includes(q)
          const matchShift = log.shift.toLowerCase().includes(q)
          const matchDept = log.department.toLowerCase().includes(q)
          if (!matchName && !matchCode && !matchShift && !matchDept) return false
        }
        return true
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    attendanceLogs,
    dateScope,
    activeDate,
    deptFilter,
    statusFilter,
    anomalyOnly,
    searchQuery,
    assignments,
    employees,
    shifts,
  ])

  // Danh sách Đối chiếu Lịch phân công trong ngày (Reconciliation list)
  const reconciliationList = useMemo(() => {
    const dayAssignments = assignments.filter(
      (a) => a.workDate === activeDate && a.status !== 'Đã hủy',
    )
    const dayLogs = attendanceLogs.filter((l) => l.workDate === activeDate)

    return dayAssignments
      .map((assign) => {
        const emp = employeeMap.get(assign.employeeId)
        const shift = shiftByIdMap.get(assign.shiftId)

        // Tìm bản ghi chấm công khớp với ca này
        const matchedLog = dayLogs.find(
          (l) =>
            (l.employeeId === assign.employeeId ||
              (emp && l.name.toLowerCase() === emp.name.toLowerCase())) &&
            (l.shiftId === assign.shiftId ||
              (shift && l.shift.toLowerCase() === shift.name.toLowerCase())),
        )

        // Hoặc nhân viên có chấm công trong ngày nhưng ở ca khác
        const anyEmpLogInDay = !matchedLog
          ? dayLogs.find(
              (l) =>
                l.employeeId === assign.employeeId ||
                (emp && l.name.toLowerCase() === emp.name.toLowerCase()),
            )
          : undefined

        let reconcileState: 'completed' | 'in_progress' | 'absent' | 'wrong_shift' | 'unrecorded' =
          'unrecorded'

        if (matchedLog) {
          if (matchedLog.status === 'Vắng mặt') reconcileState = 'absent'
          else if (matchedLog.checkOut !== null) reconcileState = 'completed'
          else reconcileState = 'in_progress'
        } else if (anyEmpLogInDay) {
          reconcileState = 'wrong_shift'
        }

        return {
          assignment: assign,
          emp,
          shift,
          matchedLog,
          anyEmpLogInDay,
          reconcileState,
        }
      })
      .filter((item) => {
        if (!item.emp) return false
        if (deptFilter !== 'Tất cả' && item.emp.department !== deptFilter) return false
        const q = searchQuery.trim().toLowerCase()
        if (q) {
          const mName = item.emp.name.toLowerCase().includes(q)
          const mCode = item.emp.code.toLowerCase().includes(q)
          const mShift = (item.shift?.name || '').toLowerCase().includes(q)
          if (!mName && !mCode && !mShift) return false
        }
        return true
      })
  }, [assignments, attendanceLogs, activeDate, employeeMap, shiftByIdMap, deptFilter, searchQuery])

  function openDetailModal(log: AttendanceItem) {
    const matchedShift =
      (log.shiftId ? shiftByIdMap.get(log.shiftId) : undefined) ||
      shiftByNameMap.get(log.shift.toLowerCase())

    const startMins = parseTimeToMinutes(log.checkIn)
    const endMins = parseTimeToMinutes(log.checkOut)
    const overnight =
      (startMins !== null && endMins !== null && endMins < startMins) ||
      Boolean(matchedShift && matchedShift.end <= matchedShift.start)

    setDetailTarget({
      record: log,
      shiftName: log.shift,
      workDate: log.workDate,
      checkIn: log.checkIn && log.checkIn !== '--:--' ? log.checkIn : matchedShift?.start || '08:00',
      checkOut: log.checkOut || '',
      breakMinutes: log.breakMinutes || 0,
      status: log.status || 'Đúng giờ',
      isOvernight: overnight,
    })
  }

  function openQuickRecordFromSchedule(
    assign: ShiftAssignment,
    emp: ScheduleEmployeeItem,
    shift: ScheduleShiftItem,
  ) {
    const overnight = shift.end <= shift.start
    setQuickRecordTarget({
      assignment: assign,
      employee: emp,
      shift,
      checkIn: shift.start,
      checkOut: '',
      breakMinutes: 0,
      isAbsent: false,
      isOvernight: overnight,
    })
  }

  // Xử lý lưu điều chỉnh bản ghi chấm công (Admin/Manager)
  async function handleSaveAdjustedRecord(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isAdmin || !detailTarget) return

    const { record, shiftName, workDate, checkIn, checkOut, breakMinutes, status, isOvernight } =
      detailTarget

    const matchedShift = shiftByNameMap.get(shiftName.toLowerCase())
    let finalCheckIn = checkIn.trim()
    let finalCheckOut: string | null = checkOut.trim() ? checkOut.trim() : null
    let finalTotalMinutes = 0
    let finalTotalHoursText = 'Đang trong ca'
    let finalStatus = status

    if (finalStatus === 'Vắng mặt') {
      finalCheckIn = '--:--'
      finalCheckOut = null
      finalTotalMinutes = 0
      finalTotalHoursText = '0h 00m'
    } else {
      const inMins = parseTimeToMinutes(finalCheckIn)
      if (inMins === null) {
        setModalError('Vui lòng nhập giờ vào ca hợp lệ (Định dạng HH:MM).')
        return
      }

      // Tự động đánh giá lại trạng thái Đúng giờ / Đi trễ nếu người dùng chọn theo chuẩn ca
      if (matchedShift) {
        const shiftStartMins = parseTimeToMinutes(matchedShift.start)
        if (shiftStartMins !== null) {
          finalStatus = inMins > shiftStartMins + maxLateMinutes ? 'Đi trễ' : 'Đúng giờ'
        }
      }

      if (finalCheckOut) {
        const calc = computeWorkedMinutes(finalCheckIn, finalCheckOut, breakMinutes, isOvernight)
        if (!calc.valid) {
          setModalError(calc.error || 'Giờ tan ca không hợp lệ.')
          return
        }
        finalTotalMinutes = calc.totalMinutes
        finalTotalHoursText = formatMinutesToHoursText(finalTotalMinutes)
      }
    }

    try {
      setIsSaving(true)
      setModalError('')
      const supabase = createClient()

      const { error } = await supabase
        .from('attendance_records')
        .update({
          shift_id: matchedShift?.id ?? record.shiftId,
          shift: shiftName,
          work_date: workDate,
          check_in: finalCheckIn,
          check_out: finalCheckOut,
          check_out_at: finalCheckOut ? new Date().toISOString() : null,
          break_minutes: finalStatus === 'Vắng mặt' ? 0 : Math.max(0, Number(breakMinutes) || 0),
          total_minutes: finalTotalMinutes,
          total_hours: finalTotalHoursText,
          status: finalStatus,
        })
        .eq('id', record.id)

      if (error) {
        setModalError(`Không thể cập nhật bản ghi: ${error.message}`)
        return
      }

      setDetailTarget(null)
      onNotify(`Đã cập nhật bản ghi chấm công của ${record.name} (${formatShortDate(workDate)}).`)
      await onRefresh()
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Lỗi kết nối khi cập nhật chấm công.')
    } finally {
      setIsSaving(false)
    }
  }

  // Xử lý Ghi nhận chấm công nhanh trực tiếp từ ca đã phân công
  async function handleSaveQuickRecord(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!quickRecordTarget) return

    const { employee, shift, assignment, checkIn, checkOut, breakMinutes, isAbsent, isOvernight } =
      quickRecordTarget

    // Kiểm tra trùng: Nếu nhân viên đã có ca đang mở chưa tan ca
    if (!isAbsent) {
      const openRecord = attendanceLogs.find(
        (log) =>
          (log.employeeId === employee.id ||
            log.name.toLowerCase() === employee.name.toLowerCase()) &&
          log.checkOut === null &&
          log.status !== 'Vắng mặt',
      )

      if (openRecord) {
        setModalError(
          `Nhân viên ${employee.name} đang có ca ngày ${formatShortDate(openRecord.workDate)} (vào lúc ${openRecord.checkIn}) chưa tan ca. Vui lòng chốt tan ca trước.`,
        )
        return
      }
    }

    let finalStatus = 'Đúng giờ'
    let finalCheckIn = checkIn.trim()
    let finalCheckOut: string | null = checkOut.trim() ? checkOut.trim() : null
    let totalMinutes = 0
    let totalHoursText = 'Đang trong ca'

    if (isAbsent) {
      finalStatus = 'Vắng mặt'
      finalCheckIn = '--:--'
      finalCheckOut = null
      totalMinutes = 0
      totalHoursText = '0h 00m'
    } else {
      const inMins = parseTimeToMinutes(finalCheckIn)
      if (inMins === null) {
        setModalError('Vui lòng nhập giờ vào ca hợp lệ.')
        return
      }

      const shiftStartMins = parseTimeToMinutes(shift.start)
      if (shiftStartMins !== null && inMins > shiftStartMins + maxLateMinutes) {
        finalStatus = 'Đi trễ'
      }

      if (finalCheckOut) {
        const calc = computeWorkedMinutes(finalCheckIn, finalCheckOut, breakMinutes, isOvernight)
        if (!calc.valid) {
          setModalError(calc.error || 'Giờ tan ca không hợp lệ.')
          return
        }
        totalMinutes = calc.totalMinutes
        totalHoursText = formatMinutesToHoursText(totalMinutes)
      }
    }

    try {
      setIsSaving(true)
      setModalError('')
      const supabase = createClient()
      const nowIso = new Date().toISOString()

      const { error } = await supabase.from('attendance_records').insert([
        {
          employee_id: employee.id,
          shift_id: shift.id,
          name: employee.name,
          initials: employee.initials,
          department: employee.department,
          shift: shift.name,
          work_date: assignment.workDate,
          check_in: finalCheckIn,
          check_out: finalCheckOut,
          check_in_at: isAbsent ? null : nowIso,
          check_out_at: finalCheckOut ? nowIso : null,
          break_minutes: isAbsent ? 0 : Math.max(0, Number(breakMinutes) || 0),
          total_minutes: totalMinutes,
          total_hours: totalHoursText,
          status: finalStatus,
          tone: employee.tone || 'teal',
        },
      ])

      if (error) {
        setModalError(
          error.code === '23505'
            ? 'Nhân viên này đã có bản ghi chấm công cho ca này.'
            : `Không thể lưu chấm công: ${error.message}`,
        )
        return
      }

      setQuickRecordTarget(null)
      onNotify(
        isAbsent
          ? `Đã ghi nhận vắng mặt cho ${employee.name} (${shift.name}).`
          : `Đã ghi nhận chấm công ${shift.name} cho ${employee.name}.`,
      )
      await onRefresh()
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Lỗi kết nối khi ghi nhận chấm công.')
    } finally {
      setIsSaving(false)
    }
  }

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    deptFilter !== 'Tất cả' ||
    statusFilter !== 'Tất cả' ||
    anomalyOnly ||
    dateScope === 'all'

  function resetFilters() {
    setSearchQuery('')
    setDeptFilter('Tất cả')
    setStatusFilter('Tất cả')
    setAnomalyOnly(false)
    setDateScope('day')
    if (todayIso) setSelectedDate(todayIso)
  }

  return (
    <div>
      {/* 1. BỐN THẺ CHỈ SỐ TỔNG QUAN CHẤM CÔNG THEO NGÀY ĐANG XEM */}
      <section
        className="metrics-grid"
        style={{ marginBottom: 18 }}
        aria-label="Chỉ số chấm công trong ngày"
      >
        <article className="metric-card">
          <div className="metric-top">
            <span>Lịch phân công ngày {formatShortDate(activeDate)}</span>
            <span className="metric-icon blue" style={{ fontWeight: 700, fontSize: 12 }}>
              LỊCH
            </span>
          </div>
          <strong className="metric-value">
            {isLoading ? '...' : dailyMetrics.scheduledCount}
          </strong>
          <p>
            {dailyMetrics.unrecordedScheduledCount > 0
              ? `${dailyMetrics.unrecordedScheduledCount} ca đã xếp lịch chưa ghi nhận`
              : dailyMetrics.scheduledCount > 0
                ? '100% ca phân công đã có bản ghi'
                : 'Chưa có ca phân công trong ngày này'}
          </p>
          <div className="metric-foot blue">
            <button
              type="button"
              onClick={() => setSubTab('reconcile')}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                fontSize: 12,
                textDecoration: 'underline',
              }}
            >
              Đối chiếu với lịch phân công →
            </button>
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-top">
            <span>Đã chấm công vào ca</span>
            <span className="metric-icon teal" style={{ fontWeight: 700, fontSize: 12 }}>
              VÀO
            </span>
          </div>
          <strong className="metric-value">
            {isLoading ? '...' : dailyMetrics.checkedInCount}
          </strong>
          <p>
            {dailyMetrics.openCount} đang trong ca · {dailyMetrics.completedCount} đã tan ca
          </p>
          <div className="metric-foot teal">
            <span className="tiny-dot" />
            Ngưỡng cho phép trễ: tối đa {maxLateMinutes} phút
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-top">
            <span>Trường hợp đi trễ</span>
            <span className="metric-icon orange" style={{ fontWeight: 700, fontSize: 12 }}>
              TRỄ
            </span>
          </div>
          <strong className="metric-value">
            {isLoading ? '...' : dailyMetrics.lateCount}
          </strong>
          <p>
            Vào ca muộn hơn {maxLateMinutes} phút · {dailyMetrics.absentCount} vắng mặt
          </p>
          <div className="metric-foot orange">
            <span className="tiny-dot" />
            Ghi nhận thực tế ngày {formatFullVNDate(activeDate)}
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-top">
            <span>Hoàn tất & Cần kiểm tra</span>
            <span className="metric-icon purple" style={{ fontWeight: 700, fontSize: 12 }}>
              SOÁT
            </span>
          </div>
          <strong className="metric-value">
            {isLoading ? '...' : `${dailyMetrics.completedCount} hoàn tất`}
          </strong>
          <p>
            {dailyMetrics.staleOpenGlobalCount > 0
              ? `${dailyMetrics.staleOpenGlobalCount} ca từ ngày cũ chưa chốt giờ ra`
              : `${dailyMetrics.needReviewCount} mục cần quản lý lưu ý`}
          </p>
          <div className="metric-foot purple">
            {dailyMetrics.staleOpenGlobalCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSubTab('logs')
                  setDateScope('all')
                  setStatusFilter('Đang trong ca')
                  setAnomalyOnly(true)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 12,
                  textDecoration: 'underline',
                }}
              >
                Lọc {dailyMetrics.staleOpenGlobalCount} ca quên tan ca →
              </button>
            ) : (
              <span>Không có ca treo quá hạn</span>
            )}
          </div>
        </article>
      </section>

      {/* 2. PANEL CHÍNH: ĐIỀU HƯỚNG NGÀY, CHẾ ĐỘ XEM & BỘ LỌC */}
      <section className="panel">
        <div
          className="panel-heading"
          style={{
            flexWrap: 'wrap',
            gap: 14,
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>
                {subTab === 'logs'
                  ? dateScope === 'day'
                    ? `Nhật ký chấm công ngày ${formatFullVNDate(activeDate)}`
                    : 'Toàn bộ lịch sử nhật ký chấm công'
                  : `Đối chiếu Lịch phân công & Thực tế (${formatFullVNDate(activeDate)})`}
              </h2>
              {activeDate === todayIso && dateScope === 'day' && (
                <span className="badge success" style={{ fontSize: 11 }}>
                  Hôm nay
                </span>
              )}
            </div>
            <p style={{ marginTop: 4 }}>
              Đối chiếu thời gian vào/ra thực tế với khung giờ ca chuẩn, phát hiện đi trễ và xử lý các ca thiếu giờ ra.
            </p>
          </div>

          {/* Chuyển đổi giữa Nhật ký chấm công & Đối chiếu lịch phân công */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                background: '#f1f5f9',
                padding: 3,
                borderRadius: 10,
                border: '1px solid #e2e8f0',
              }}
            >
              <button
                type="button"
                onClick={() => setSubTab('logs')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: subTab === 'logs' ? '#ffffff' : 'transparent',
                  color: subTab === 'logs' ? '#0f172a' : '#64748b',
                  boxShadow: subTab === 'logs' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                Nhật ký chấm công ({filteredAttendanceList.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubTab('reconcile')
                  setDateScope('day')
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: subTab === 'reconcile' ? '#ffffff' : 'transparent',
                  color: subTab === 'reconcile' ? '#0f172a' : '#64748b',
                  boxShadow: subTab === 'reconcile' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                Đối chiếu lịch phân công ({dailyMetrics.scheduledCount})
              </button>
            </div>

            <button type="button" className="secondary-button" onClick={onExportCsv}>
              ↓ Xuất CSV
            </button>
            <button type="button" className="primary-button" onClick={onOpenCheckInModal}>
              + Vào ca / Chấm công
            </button>
          </div>
        </div>

        {/* Thanh điều hướng ngày nhanh & phạm vi thời gian */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            padding: '12px 22px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setDateScope('day')
                setSelectedDate(addDaysToIso(activeDate, -1))
              }}
            >
              ← Ngày trước
            </button>
            <input
              type="date"
              value={activeDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value)
                  setDateScope('day')
                }
              }}
              aria-label="Chọn ngày xem chấm công"
              style={{
                padding: '7px 10px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                background: '#ffffff',
              }}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setDateScope('day')
                if (todayIso) setSelectedDate(todayIso)
              }}
            >
              Hôm nay
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setDateScope('day')
                setSelectedDate(addDaysToIso(activeDate, 1))
              }}
            >
              Ngày sau →
            </button>

            {subTab === 'logs' && (
              <button
                type="button"
                className={`pill-btn ${dateScope === 'all' ? 'active' : ''}`}
                onClick={() => setDateScope(dateScope === 'all' ? 'day' : 'all')}
                style={{ marginLeft: 4 }}
              >
                {dateScope === 'all' ? 'Đang xem: Tất cả các ngày' : 'Xem tất cả các ngày'}
              </button>
            )}
          </div>

          <div style={{ fontSize: 12.5, color: '#475569' }}>
            {subTab === 'logs' ? (
              <span>
                Hiển thị <strong>{filteredAttendanceList.length}</strong> bản ghi chấm công
              </span>
            ) : (
              <span>
                Hiển thị <strong>{reconciliationList.length}</strong> ca phân công trong ngày
              </span>
            )}
          </div>
        </div>

        {/* Thanh tìm kiếm & Bộ lọc chi tiết */}
        <div
          className="module-toolbar"
          style={{
            flexWrap: 'wrap',
            gap: 10,
            paddingBottom: 14,
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div className="search-box" style={{ minWidth: 230, flex: '1 1 230px' }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã NV (SF-...), tên nhân viên, ca làm..."
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              aria-label="Lọc theo phòng ban"
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontSize: 13,
                background: deptFilter !== 'Tất cả' ? '#f0fdfa' : '#ffffff',
              }}
            >
              <option value="Tất cả">Tất cả phòng ban</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {subTab === 'logs' && (
              <>
                <div className="filter-pills">
                  {[
                    'Tất cả',
                    'Đang trong ca',
                    'Đã hoàn tất',
                    'Đúng giờ',
                    'Đi trễ',
                    'Vắng mặt',
                  ].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`pill-btn ${statusFilter === st ? 'active' : ''}`}
                      onClick={() => setStatusFilter(st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12.5,
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: anomalyOnly ? '#fffbeb' : '#ffffff',
                    color: anomalyOnly ? '#92400e' : '#334155',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={anomalyOnly}
                    onChange={(e) => setAnomalyOnly(e.target.checked)}
                  />
                  Cần kiểm tra / Bất thường
                </label>
              </>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid #fecaca',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>

        {/* NỘI DUNG BẢNG DỮ LIỆU */}
        {isLoading ? (
          <div className="table-note" style={{ padding: '40px 22px', textAlign: 'center' }}>
            Đang tải và đối chiếu dữ liệu chấm công từ Supabase...
          </div>
        ) : subTab === 'logs' ? (
          /* TAB 1: BẢNG NHẬT KÝ CHẤM CÔNG & ĐỐI CHIẾU CHÊNH LỆCH */
          filteredAttendanceList.length === 0 ? (
            <div className="table-note" style={{ padding: '36px 22px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 10px', fontSize: 14 }}>
                {dateScope === 'day'
                  ? `Chưa có bản ghi chấm công nào trong ngày ${formatFullVNDate(activeDate)} khớp với bộ lọc.`
                  : 'Không tìm thấy bản ghi chấm công nào khớp với bộ lọc hiện tại.'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                {dateScope === 'day' && attendanceLogs.length > 0 && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setDateScope('all')}
                  >
                    Xem tất cả các ngày ({attendanceLogs.length} bản ghi)
                  </button>
                )}
                <button type="button" className="primary-button" onClick={onOpenCheckInModal}>
                  + Ghi nhận Vào ca ngay
                </button>
              </div>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Mã & Nhân viên</th>
                    <th>Phòng ban</th>
                    <th>Ca & Khung giờ chuẩn</th>
                    <th>Giờ vào thực tế</th>
                    <th>Giờ ra thực tế</th>
                    <th>Thời gian thực làm</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendanceList.map(({ log, meta }) => {
                    const isOpenShift = log.checkOut === null && log.status !== 'Vắng mặt'

                    return (
                      <tr key={log.id}>
                        <td>
                          <strong>{formatShortDate(log.workDate)}</strong>
                          <small style={{ display: 'block', color: '#64748b', fontSize: 11 }}>
                            {log.workDate.slice(0, 4)}
                          </small>
                        </td>

                        <td>
                          <div className="employee-cell">
                            <span className={`avatar ${log.tone}`}>{log.initials}</span>
                            <div>
                              <strong>{log.name}</strong>
                              <small style={{ display: 'block', color: '#64748b' }}>
                                {meta.empCode}
                                {meta.empRole ? ` · ${meta.empRole}` : ''}
                              </small>
                            </div>
                          </div>
                        </td>

                        <td>{log.department}</td>

                        <td>
                          <strong>{log.shift}</strong>
                          <small style={{ display: 'block', color: '#64748b', fontSize: 11.5 }}>
                            Chuẩn: {meta.scheduledWindow}
                          </small>
                          {meta.exactScheduledAssignment ? (
                            <span
                              style={{
                                display: 'inline-block',
                                marginTop: 3,
                                fontSize: 10.5,
                                fontWeight: 600,
                                color: '#0f766e',
                                background: '#f0fdfa',
                                padding: '1px 6px',
                                borderRadius: 4,
                              }}
                            >
                              ✓ Khớp lịch phân công
                            </span>
                          ) : meta.isDifferentShiftFromSchedule ? (
                            <span
                              style={{
                                display: 'inline-block',
                                marginTop: 3,
                                fontSize: 10.5,
                                fontWeight: 600,
                                color: '#b45309',
                                background: '#fffbeb',
                                padding: '1px 6px',
                                borderRadius: 4,
                              }}
                            >
                              ! Khác ca đã phân công
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                marginTop: 3,
                                fontSize: 10.5,
                                color: '#64748b',
                                background: '#f1f5f9',
                                padding: '1px 6px',
                                borderRadius: 4,
                              }}
                            >
                              Ngoài lịch phân công
                            </span>
                          )}
                        </td>

                        <td>
                          <strong style={{ fontSize: 13.5 }}>{log.checkIn}</strong>
                          <small
                            style={{
                              display: 'block',
                              fontSize: 11,
                              fontWeight: 600,
                              color:
                                meta.checkInDiffTone === 'teal'
                                  ? '#0f766e'
                                  : meta.checkInDiffTone === 'orange'
                                    ? '#b45309'
                                    : meta.checkInDiffTone === 'red'
                                      ? '#b91c1c'
                                      : '#64748b',
                            }}
                          >
                            {meta.checkInDiffLabel}
                          </small>
                        </td>

                        <td>
                          {log.checkOut ? (
                            <strong>{log.checkOut}</strong>
                          ) : log.status === 'Vắng mặt' ? (
                            '--:--'
                          ) : meta.isStaleOpenShift ? (
                            <span className="badge danger" title="Ca từ ngày cũ chưa bấm tan ca">
                              Quên tan ca
                            </span>
                          ) : (
                            <span className="badge neutral">Đang trong ca</span>
                          )}
                        </td>

                        <td>
                          <strong>{log.totalHours}</strong>
                          {log.breakMinutes > 0 && (
                            <small style={{ display: 'block', color: '#64748b', fontSize: 11 }}>
                              Nghỉ giữa ca: {log.breakMinutes}p
                            </small>
                          )}
                          {meta.durationDiffMinutes !== null && (
                            <small
                              style={{
                                display: 'block',
                                fontSize: 11,
                                color:
                                  meta.durationDiffMinutes >= 0 ? '#0f766e' : '#b45309',
                              }}
                            >
                              {meta.durationDiffMinutes === 0
                                ? 'Đủ giờ chuẩn'
                                : meta.durationDiffMinutes > 0
                                  ? `Vượt +${meta.durationDiffMinutes}p`
                                  : `Thiếu ${Math.abs(meta.durationDiffMinutes)}p`}
                            </small>
                          )}
                        </td>

                        <td>
                          <span
                            className={`badge ${
                              log.status === 'Đúng giờ'
                                ? 'success'
                                : log.status === 'Đi trễ'
                                  ? 'warning'
                                  : 'danger'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>

                        <td>
                          <div className="action-group" style={{ flexWrap: 'wrap', gap: 6 }}>
                            {isOpenShift && (
                              <button
                                type="button"
                                className="mini-btn approve"
                                onClick={() => onOpenCheckOutModal(log)}
                              >
                                Tan ca
                              </button>
                            )}
                            <button
                              type="button"
                              className="mini-btn"
                              onClick={() => openDetailModal(log)}
                              style={{
                                background: '#f1f5f9',
                                color: '#334155',
                                border: '1px solid #cbd5e1',
                              }}
                            >
                              {isAdmin ? 'Chi tiết / Sửa' : 'Chi tiết'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* TAB 2: BẢNG ĐỐI CHIẾU LỊCH PHÂN CÔNG TRONG NGÀY VỚI CHẤM CÔNG THỰC TẾ */
          reconciliationList.length === 0 ? (
            <div className="table-note" style={{ padding: '36px 22px', textAlign: 'center' }}>
              Không có ca làm việc nào được phân công trong ngày {formatFullVNDate(activeDate)}{' '}
              khớp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nhân viên được phân công</th>
                    <th>Phòng ban</th>
                    <th>Ca phân công & Giờ chuẩn</th>
                    <th>Trạng thái lịch</th>
                    <th>Giờ vào / ra thực tế</th>
                    <th>Kết quả đối chiếu</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliationList.map(
                    ({
                      assignment,
                      emp,
                      shift,
                      matchedLog,
                      anyEmpLogInDay,
                      reconcileState,
                    }) => {
                      if (!emp) return null
                      const shiftName = shift?.name || `Ca #${assignment.shiftId}`
                      const shiftWindow = shift ? `${shift.start} – ${shift.end}` : '--:--'

                      return (
                        <tr key={assignment.id}>
                          <td>
                            <div className="employee-cell">
                              <span className={`avatar ${emp.tone}`}>{emp.initials}</span>
                              <div>
                                <strong>{emp.name}</strong>
                                <small style={{ display: 'block', color: '#64748b' }}>
                                  {emp.code} · {emp.role}
                                </small>
                              </div>
                            </div>
                          </td>

                          <td>{emp.department}</td>

                          <td>
                            <strong>{shiftName}</strong>
                            <small style={{ display: 'block', color: '#64748b' }}>
                              Khung giờ: {shiftWindow}
                            </small>
                          </td>

                          <td>
                            <span
                              className={`badge ${
                                assignment.status === 'Đã phân công' ? 'success' : 'warning'
                              }`}
                            >
                              {assignment.status}
                            </span>
                          </td>

                          <td>
                            {matchedLog ? (
                              <div>
                                <strong>
                                  {matchedLog.checkIn} → {matchedLog.checkOut || 'Đang làm'}
                                </strong>
                                <small style={{ display: 'block', color: '#64748b' }}>
                                  Tổng: {matchedLog.totalHours}
                                </small>
                              </div>
                            ) : anyEmpLogInDay ? (
                              <div>
                                <strong style={{ color: '#b45309' }}>
                                  Đã chấm ở {anyEmpLogInDay.shift} ({anyEmpLogInDay.checkIn})
                                </strong>
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: 12.5 }}>
                                Chưa có bản ghi
                              </span>
                            )}
                          </td>

                          <td>
                            {reconcileState === 'completed' && matchedLog && (
                              <span
                                className={`badge ${
                                  matchedLog.status === 'Đi trễ' ? 'warning' : 'success'
                                }`}
                              >
                                Đã hoàn tất ({matchedLog.status})
                              </span>
                            )}
                            {reconcileState === 'in_progress' && matchedLog && (
                              <span className="badge neutral">
                                Đang trong ca ({matchedLog.status})
                              </span>
                            )}
                            {reconcileState === 'absent' && (
                              <span className="badge danger">Đã ghi nhận Vắng mặt</span>
                            )}
                            {reconcileState === 'wrong_shift' && (
                              <span className="badge warning">Chấm công khác ca phân công</span>
                            )}
                            {reconcileState === 'unrecorded' && (
                              <span
                                className="badge warning"
                                title="Không tự động kết luận vắng mặt khi chưa chốt ca"
                              >
                                Chưa chấm công
                              </span>
                            )}
                          </td>

                          <td>
                            {matchedLog ? (
                              <div className="action-group" style={{ gap: 6 }}>
                                {matchedLog.checkOut === null &&
                                  matchedLog.status !== 'Vắng mặt' && (
                                    <button
                                      type="button"
                                      className="mini-btn approve"
                                      onClick={() => onOpenCheckOutModal(matchedLog)}
                                    >
                                      Tan ca
                                    </button>
                                  )}
                                <button
                                  type="button"
                                  className="mini-btn"
                                  onClick={() => openDetailModal(matchedLog)}
                                  style={{
                                    background: '#f1f5f9',
                                    color: '#334155',
                                    border: '1px solid #cbd5e1',
                                  }}
                                >
                                  Chi tiết
                                </button>
                              </div>
                            ) : shift ? (
                              <button
                                type="button"
                                className="mini-btn approve"
                                onClick={() => openQuickRecordFromSchedule(assignment, emp, shift)}
                              >
                                + Ghi nhận vào ca
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      )
                    },
                  )}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>

      {/* ==========================================================================
          HỘP THOẠI CHI TIẾT & ĐIỀU CHỈNH BẢN GHI CHẤM CÔNG (DÀNH CHO QUẢN LÝ)
      ========================================================================== */}
      {detailTarget && (
        <dialog
          ref={detailDialogRef}
          className="dashboard-modal"
          style={{ width: 'min(560px, 95vw)' }}
          onCancel={() => !isSaving && setDetailTarget(null)}
          onClick={(e) => !isSaving && e.target === e.currentTarget && setDetailTarget(null)}
        >
          <div className="modal-heading">
            <h2>
              {isAdmin ? 'Chi tiết & Điều chỉnh chấm công' : 'Chi tiết bản ghi chấm công'}
            </h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => !isSaving && setDetailTarget(null)}
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>

          {modalError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {modalError}
            </div>
          )}

          {(() => {
            const meta = analyzeAttendanceRecord(detailTarget.record)

            return (
              <form className="shift-form" onSubmit={handleSaveAdjustedRecord}>
                <div
                  className="review-person"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <span className={`avatar ${detailTarget.record.tone}`}>
                    {detailTarget.record.initials}
                  </span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15 }}>{detailTarget.record.name}</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>
                      {meta.empCode} · {detailTarget.record.department}
                    </p>
                  </div>
                </div>

                {/* Khung thông tin đối chiếu chuẩn */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: '#f0fdfa',
                    border: '1px solid #ccfbf1',
                    fontSize: 12.5,
                    color: '#134e4a',
                    display: 'grid',
                    gap: 4,
                  }}
                >
                  <div>
                    <strong>Khung giờ ca chuẩn:</strong> {meta.scheduledWindow}
                  </div>
                  <div>
                    <strong>Đối chiếu giờ vào:</strong> {meta.checkInDiffLabel}
                  </div>
                  <div>
                    <strong>Trạng thái khớp lịch:</strong>{' '}
                    {meta.exactScheduledAssignment
                      ? 'Khớp với ca được phân công trên lịch tuần'
                      : meta.isDifferentShiftFromSchedule
                        ? 'Khác với ca được phân công trong ngày'
                        : 'Bản ghi ngoài lịch phân công'}
                  </div>
                </div>

                <div className="form-split">
                  <label>
                    Ngày làm việc
                    <input
                      type="date"
                      value={detailTarget.workDate}
                      onChange={(e) =>
                        setDetailTarget({ ...detailTarget, workDate: e.target.value })
                      }
                      disabled={!isAdmin}
                      required
                    />
                  </label>

                  <label>
                    Ca làm việc
                    <select
                      value={detailTarget.shiftName}
                      onChange={(e) =>
                        setDetailTarget({ ...detailTarget, shiftName: e.target.value })
                      }
                      disabled={!isAdmin}
                    >
                      {shifts.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} ({s.start} – {s.end})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="form-split">
                  <label>
                    Giờ vào thực tế
                    <input
                      type="time"
                      value={detailTarget.checkIn}
                      onChange={(e) =>
                        setDetailTarget({ ...detailTarget, checkIn: e.target.value })
                      }
                      disabled={!isAdmin || detailTarget.status === 'Vắng mặt'}
                      required={detailTarget.status !== 'Vắng mặt'}
                    />
                  </label>

                  <label>
                    Giờ tan ca (Để trống nếu đang làm)
                    <input
                      type="time"
                      value={detailTarget.checkOut}
                      onChange={(e) =>
                        setDetailTarget({ ...detailTarget, checkOut: e.target.value })
                      }
                      disabled={!isAdmin || detailTarget.status === 'Vắng mặt'}
                    />
                  </label>
                </div>

                <div className="form-split">
                  <label>
                    Nghỉ giữa ca (Phút)
                    <input
                      type="number"
                      min={0}
                      max={240}
                      value={detailTarget.breakMinutes}
                      onChange={(e) =>
                        setDetailTarget({
                          ...detailTarget,
                          breakMinutes: Number(e.target.value),
                        })
                      }
                      disabled={!isAdmin || detailTarget.status === 'Vắng mặt'}
                    />
                  </label>

                  <label>
                    Trạng thái chấm công
                    <select
                      value={detailTarget.status}
                      onChange={(e) =>
                        setDetailTarget({ ...detailTarget, status: e.target.value })
                      }
                      disabled={!isAdmin}
                    >
                      <option value="Đúng giờ">Đúng giờ</option>
                      <option value="Đi trễ">Đi trễ</option>
                      <option value="Vắng mặt">Vắng mặt</option>
                    </select>
                  </label>
                </div>

                {isAdmin && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexDirection: 'row',
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={detailTarget.isOvernight}
                      onChange={(e) =>
                        setDetailTarget({ ...detailTarget, isOvernight: e.target.checked })
                      }
                    />
                    Ca làm việc qua ngày hôm sau (Qua 00:00)
                  </label>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setDetailTarget(null)}
                    disabled={isSaving}
                  >
                    Đóng
                  </button>
                  {isAdmin && (
                    <button type="submit" className="primary-button" disabled={isSaving}>
                      {isSaving ? 'Đang cập nhật...' : 'Lưu điều chỉnh chấm công'}
                    </button>
                  )}
                </div>
              </form>
            )
          })()}
        </dialog>
      )}

      {/* ==========================================================================
          HỘP THOẠI GHI NHẬN CHẤM CÔNG NHANH TỪ DÒNG LỊCH PHÂN CÔNG
      ========================================================================== */}
      {quickRecordTarget && (
        <dialog
          ref={quickDialogRef}
          className="dashboard-modal"
          style={{ width: 'min(520px, 95vw)' }}
          onCancel={() => !isSaving && setQuickRecordTarget(null)}
          onClick={(e) =>
            !isSaving && e.target === e.currentTarget && setQuickRecordTarget(null)
          }
        >
          <div className="modal-heading">
            <h2>Ghi nhận chấm công theo lịch</h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => !isSaving && setQuickRecordTarget(null)}
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>

          {modalError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {modalError}
            </div>
          )}

          <form className="shift-form" onSubmit={handleSaveQuickRecord}>
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: 13,
              }}
            >
              <strong>
                {quickRecordTarget.employee.code} – {quickRecordTarget.employee.name}
              </strong>
              <div style={{ color: '#475569', marginTop: 4 }}>
                Ca phân công: <strong>{quickRecordTarget.shift.name}</strong> (
                {quickRecordTarget.shift.start} – {quickRecordTarget.shift.end}) · Ngày{' '}
                <strong>{formatFullVNDate(quickRecordTarget.assignment.workDate)}</strong>
              </div>
            </div>

            <div className="form-split">
              <label>
                Giờ vào ca thực tế
                <input
                  type="time"
                  value={quickRecordTarget.checkIn}
                  onChange={(e) =>
                    setQuickRecordTarget({
                      ...quickRecordTarget,
                      checkIn: e.target.value,
                    })
                  }
                  disabled={quickRecordTarget.isAbsent}
                  required={!quickRecordTarget.isAbsent}
                />
              </label>

              <label>
                Giờ tan ca (Để trống nếu đang làm)
                <input
                  type="time"
                  value={quickRecordTarget.checkOut}
                  onChange={(e) =>
                    setQuickRecordTarget({
                      ...quickRecordTarget,
                      checkOut: e.target.value,
                    })
                  }
                  disabled={quickRecordTarget.isAbsent}
                />
              </label>
            </div>

            <label>
              Nghỉ giữa giờ (Phút)
              <input
                type="number"
                min={0}
                max={240}
                value={quickRecordTarget.breakMinutes}
                onChange={(e) =>
                  setQuickRecordTarget({
                    ...quickRecordTarget,
                    breakMinutes: Number(e.target.value),
                  })
                }
                disabled={quickRecordTarget.isAbsent}
              />
            </label>

            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexDirection: 'row',
                }}
              >
                <input
                  type="checkbox"
                  checked={quickRecordTarget.isOvernight}
                  onChange={(e) =>
                    setQuickRecordTarget({
                      ...quickRecordTarget,
                      isOvernight: e.target.checked,
                    })
                  }
                />
                Ca qua ngày hôm sau
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexDirection: 'row',
                }}
              >
                <input
                  type="checkbox"
                  checked={quickRecordTarget.isAbsent}
                  onChange={(e) =>
                    setQuickRecordTarget({
                      ...quickRecordTarget,
                      isAbsent: e.target.checked,
                    })
                  }
                />
                Đánh dấu Vắng mặt
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setQuickRecordTarget(null)}
                disabled={isSaving}
              >
                Hủy
              </button>
              <button type="submit" className="primary-button" disabled={isSaving}>
                {isSaving ? 'Đang lưu...' : 'Xác nhận lưu chấm công'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  )
}