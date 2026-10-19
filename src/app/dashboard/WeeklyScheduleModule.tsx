'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  findShiftTimeConflict,
  type ShiftTimeDefinition,
  type AssignmentForConflictCheck,
} from '@/lib/scheduleConflict'
import {
  checkLeaveConflict,
  calculateAndCheckWorkHours,
  checkMinRestBetweenShifts,
  type LeaveRequestRecord,
  type SchedulePolicyConfig,
} from '@/lib/scheduleValidation'

export type ScheduleShiftItem = {
  id: number
  name: string
  start: string
  end: string
  count: number
  status: string
}

export type ScheduleEmployeeItem = {
  id: number
  code: string
  name: string
  initials: string
  email: string
  role: string
  department: string
  shift: string
  status: string
  tone: string
}

export type ShiftAssignmentRow = {
  id: number
  employee_id: number
  shift_id: number
  shift_name?: string | null
  work_date: string
  status: string | null
  note: string | null
  created_at?: string
  updated_at?: string
}

export type ShiftAssignment = {
  id: number
  employeeId: number
  shiftId: number
  workDate: string
  status: 'Đã phân công' | 'Dự kiến' | 'Đã hủy'
  note: string
  createdAt?: string
  updatedAt?: string
}

type WeekDayColumn = {
  isoDate: string
  dayName: string
  shortLabel: string
  shortDate: string
  isToday: boolean
}

type WeeklyScheduleProps = {
  shifts: ScheduleShiftItem[]
  employees: ScheduleEmployeeItem[]
  departments: string[]
  assignments: ShiftAssignment[]
  leaveRequests?: LeaveRequestRecord[]
  policyConfig?: SchedulePolicyConfig
  todayIso: string
  isLoading: boolean
  isAdmin: boolean
  onRefresh: () => Promise<void>
  onNotify: (msg: string) => void
  onOpenCreateShiftTemplate: () => void
}

type ShiftColorPalette = {
  bg: string
  border: string
  accent: string
  text: string
  subtext: string
  badgeBg: string
  badgeText: string
  label: string
}

type CandidateAssignmentItem = {
  key: string
  employeeId: number
  employeeCode: string
  employeeName: string
  department: string
  shiftId: number
  shiftName: string
  shiftTime: string
  workDate: string
  dayLabel: string
  status: 'Đã phân công' | 'Dự kiến'
  note: string
  isValid: boolean
  reason?: string
  warning?: string
}

type BatchExecutionSummary = {
  title: string
  totalAttempted: number
  succeededCount: number
  skippedCount: number
  failedCount: number
  details: string[]
}

function getMondayOfIsoDate(isoDate: string): string {
  const parts = isoDate.split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  const day = dt.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  dt.setUTCDate(dt.getUTCDate() + diffToMonday)
  return dt.toISOString().slice(0, 10)
}

function addDaysToIsoDate(isoDate: string, daysToAdd: number): string {
  const parts = isoDate.split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  dt.setUTCDate(dt.getUTCDate() + daysToAdd)
  return dt.toISOString().slice(0, 10)
}

function formatIsoToVN(isoDate: string): string {
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function formatIsoToShort(isoDate: string): string {
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  return `${parts[2]}/${parts[1]}`
}

function getWeekdayNameFromIso(isoDate: string): string {
  const parts = isoDate.split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return ''
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  const day = dt.getUTCDay()
  return day === 0 ? 'Chủ nhật' : `Thứ ${day + 1}`
}

function isOvernightShift(start: string, end: string): boolean {
  return Boolean(start && end && end <= start)
}

function computeShiftDurationHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0
  const startMins = sh * 60 + sm
  let endMins = eh * 60 + em
  if (endMins <= startMins) endMins += 24 * 60
  return Number(((endMins - startMins) / 60).toFixed(1))
}

/**
 * Bảo vệ chống CSV Formula Injection & xử lý dấu phẩy, ngoặc kép, xuống dòng
 */
function sanitizeAndEscapeCsvCell(value: unknown): string {
  let str = value === null || value === undefined ? '' : String(value)
  // Phòng chống CSV Formula Injection khi mở bằng Excel / Google Sheets
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function getShiftPalette(
  startTime: string,
  endTime: string,
  assignmentStatus?: 'Đã phân công' | 'Dự kiến' | 'Đã hủy',
): ShiftColorPalette {
  if (assignmentStatus === 'Đã hủy') {
    return {
      bg: '#f8fafc',
      border: '#cbd5e1',
      accent: '#94a3b8',
      text: '#64748b',
      subtext: '#94a3b8',
      badgeBg: '#e2e8f0',
      badgeText: '#475569',
      label: 'Đã hủy',
    }
  }

  if (assignmentStatus === 'Dự kiến') {
    return {
      bg: '#fffbeb',
      border: '#fde68a',
      accent: '#f59e0b',
      text: '#92400e',
      subtext: '#b45309',
      badgeBg: '#fef3c7',
      badgeText: '#b45309',
      label: 'Dự kiến',
    }
  }

  const hour = Number(startTime.split(':')[0] || 8)
  const overnight = isOvernightShift(startTime, endTime)

  if (overnight || hour >= 18 || hour < 5) {
    return {
      bg: '#f5f3ff',
      border: '#ddd6fe',
      accent: '#6366f1',
      text: '#312e81',
      subtext: '#4f46e5',
      badgeBg: '#ede9fe',
      badgeText: '#4338ca',
      label: overnight ? 'Ca qua đêm' : 'Ca tối',
    }
  }

  if (hour >= 12) {
    return {
      bg: '#eff6ff',
      border: '#bfdbfe',
      accent: '#0284c7',
      text: '#0c4a6e',
      subtext: '#0369a1',
      badgeBg: '#dbeafe',
      badgeText: '#1d4ed8',
      label: 'Ca chiều',
    }
  }

  return {
    bg: '#f0fdfa',
    border: '#99f6e4',
    accent: '#0d9488',
    text: '#134e4a',
    subtext: '#0f766e',
    badgeBg: '#ccfbf1',
    badgeText: '#0f766e',
    label: 'Ca sáng',
  }
}

const DAY_LABELS = [
  { full: 'Thứ 2', short: 'T2' },
  { full: 'Thứ 3', short: 'T3' },
  { full: 'Thứ 4', short: 'T4' },
  { full: 'Thứ 5', short: 'T5' },
  { full: 'Thứ 6', short: 'T6' },
  { full: 'Thứ 7', short: 'T7' },
  { full: 'Chủ nhật', short: 'CN' },
]

export default function WeeklyScheduleModule({
  shifts,
  employees,
  departments,
  assignments,
  leaveRequests = [],
  policyConfig = {},
  todayIso,
  isLoading,
  isAdmin,
  onRefresh,
  onNotify,
  onOpenCreateShiftTemplate,
}: WeeklyScheduleProps) {
  const [weekMondayIso, setWeekMondayIso] = useState<string>('')
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week')
  const [selectedDayIso, setSelectedDayIso] = useState<string>('')

  // Bộ lọc
  const [searchEmp, setSearchEmp] = useState<string>('')
  const [deptFilter, setDeptFilter] = useState<string>('Tất cả')
  const [shiftFilter, setShiftFilter] = useState<string>('Tất cả')
  const [statusFilter, setStatusFilter] = useState<string>('Đang hiệu lực')
  const [onlyAssignedFilter, setOnlyAssignedFilter] = useState<boolean>(false)

  // Trạng thái lưu & tương tác đơn lẻ
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [formValidationWarning, setFormValidationWarning] = useState<string>('')

  const [createTarget, setCreateTarget] = useState<{
    employeeId: number
    workDate: string
    shiftId: number
    status: 'Đã phân công' | 'Dự kiến'
    note: string
  } | null>(null)

  const [editTarget, setEditTarget] = useState<{
    id: number
    employeeId: number
    workDate: string
    shiftId: number
    status: 'Đã phân công' | 'Dự kiến' | 'Đã hủy'
    note: string
    createdAt?: string
  } | null>(null)

  // State cho Phase 2A.4: Sao chép lịch tuần trước & Phân ca hàng loạt
  const [isCopyModalOpen, setIsCopyModalOpen] = useState<boolean>(false)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false)
  const [batchSummary, setBatchSummary] = useState<BatchExecutionSummary | null>(null)

  // State cấu hình Phân ca hàng loạt (Bulk Assignment)
  const [bulkSelectedEmpIds, setBulkSelectedEmpIds] = useState<number[]>([])
  const [bulkSelectedDates, setBulkSelectedDates] = useState<string[]>([])
  const [bulkShiftId, setBulkShiftId] = useState<number>(0)
  const [bulkStatus, setBulkStatus] = useState<'Đã phân công' | 'Dự kiến'>('Đã phân công')
  const [bulkNote, setBulkNote] = useState<string>('')
  const [bulkDeptFilter, setBulkDeptFilter] = useState<string>('Tất cả')
  const [bulkEmpSearch, setBulkEmpSearch] = useState<string>('')

  const createDialogRef = useRef<HTMLDialogElement>(null)
  const editDialogRef = useRef<HTMLDialogElement>(null)
  const copyDialogRef = useRef<HTMLDialogElement>(null)
  const bulkDialogRef = useRef<HTMLDialogElement>(null)
  const summaryDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (todayIso && !weekMondayIso) {
      setWeekMondayIso(getMondayOfIsoDate(todayIso))
      setSelectedDayIso(todayIso)
    }
  }, [todayIso, weekMondayIso])

  useEffect(() => {
    if (createTarget && createDialogRef.current && !createDialogRef.current.open) {
      setFormValidationWarning('')
      createDialogRef.current.showModal()
    }
  }, [createTarget])

  useEffect(() => {
    if (editTarget && editDialogRef.current && !editDialogRef.current.open) {
      setFormValidationWarning('')
      editDialogRef.current.showModal()
    }
  }, [editTarget])

  useEffect(() => {
    if (isCopyModalOpen && copyDialogRef.current && !copyDialogRef.current.open) {
      copyDialogRef.current.showModal()
    }
  }, [isCopyModalOpen])

  useEffect(() => {
    if (isBulkModalOpen && bulkDialogRef.current && !bulkDialogRef.current.open) {
      bulkDialogRef.current.showModal()
    }
  }, [isBulkModalOpen])

  useEffect(() => {
    if (batchSummary && summaryDialogRef.current && !summaryDialogRef.current.open) {
      summaryDialogRef.current.showModal()
    }
  }, [batchSummary])

  const weekDays = useMemo<WeekDayColumn[]>(() => {
    if (!weekMondayIso) return []
    return DAY_LABELS.map((item, idx) => {
      const iso = addDaysToIsoDate(weekMondayIso, idx)
      return {
        isoDate: iso,
        dayName: item.full,
        shortLabel: item.short,
        shortDate: formatIsoToShort(iso),
        isToday: iso === todayIso,
      }
    })
  }, [weekMondayIso, todayIso])

  const weekStartIso = weekDays[0]?.isoDate || ''
  const weekEndIso = weekDays[6]?.isoDate || ''
  const prevWeekStartIso = weekStartIso ? addDaysToIsoDate(weekStartIso, -7) : ''
  const prevWeekEndIso = weekEndIso ? addDaysToIsoDate(weekEndIso, -7) : ''

  useEffect(() => {
    if (weekDays.length === 7) {
      const inCurrentWeek = weekDays.some((d) => d.isoDate === selectedDayIso)
      if (!inCurrentWeek) {
        const todayInWeek = weekDays.find((d) => d.isToday)
        setSelectedDayIso(todayInWeek ? todayInWeek.isoDate : weekDays[0].isoDate)
      }
    }
  }, [weekDays, selectedDayIso])

  const shiftMap = useMemo(() => {
    const map = new Map<number, ScheduleShiftItem>()
    for (const s of shifts) map.set(s.id, s)
    return map
  }, [shifts])

  const shiftDefMap = useMemo(() => {
    const map = new Map<number, ShiftTimeDefinition>()
    for (const s of shifts) {
      map.set(s.id, { id: s.id, name: s.name, start: s.start, end: s.end })
    }
    return map
  }, [shifts])

  const employeeMap = useMemo(() => {
    const map = new Map<number, ScheduleEmployeeItem>()
    for (const e of employees) map.set(e.id, e)
    return map
  }, [employees])

  const weekAssignments = useMemo(() => {
    if (!weekStartIso || !weekEndIso) return []
    return assignments.filter((a) => a.workDate >= weekStartIso && a.workDate <= weekEndIso)
  }, [assignments, weekStartIso, weekEndIso])

  const weekSummaryStats = useMemo(() => {
    const activeInWeek = weekAssignments.filter((a) => a.status !== 'Đã hủy')
    const officialCount = activeInWeek.filter((a) => a.status === 'Đã phân công').length
    const draftCount = activeInWeek.filter((a) => a.status === 'Dự kiến').length
    const cancelledCount = weekAssignments.filter((a) => a.status === 'Đã hủy').length

    let totalScheduledHours = 0
    const uniqueEmpIds = new Set<number>()
    let overnightCount = 0

    for (const a of activeInWeek) {
      uniqueEmpIds.add(a.employeeId)
      const s = shiftMap.get(a.shiftId)
      if (s) {
        totalScheduledHours += computeShiftDurationHours(s.start, s.end)
        if (isOvernightShift(s.start, s.end)) overnightCount += 1
      }
    }

    return {
      totalActive: activeInWeek.length,
      officialCount,
      draftCount,
      cancelledCount,
      totalScheduledHours: Number(totalScheduledHours.toFixed(1)),
      assignedEmployeeCount: uniqueEmpIds.size,
      overnightCount,
    }
  }, [weekAssignments, shiftMap])

  const empWeeklyStatsMap = useMemo(() => {
    const map = new Map<number, { count: number; hours: number }>()
    for (const emp of employees) {
      map.set(emp.id, { count: 0, hours: 0 })
    }
    for (const a of weekAssignments) {
      if (a.status === 'Đã hủy') continue
      const current = map.get(a.employeeId) || { count: 0, hours: 0 }
      const s = shiftMap.get(a.shiftId)
      const dur = s ? computeShiftDurationHours(s.start, s.end) : 0
      map.set(a.employeeId, {
        count: current.count + 1,
        hours: Number((current.hours + dur).toFixed(1)),
      })
    }
    return map
  }, [employees, weekAssignments, shiftMap])

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchDept = deptFilter === 'Tất cả' || emp.department === deptFilter
      const q = searchEmp.trim().toLowerCase()
      const matchSearch =
        !q ||
        emp.name.toLowerCase().includes(q) ||
        emp.code.toLowerCase().includes(q) ||
        emp.role.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q)

      if (!matchDept || !matchSearch) return false

      if (onlyAssignedFilter) {
        const stats = empWeeklyStatsMap.get(emp.id)
        if (!stats || stats.count === 0) return false
      }

      return true
    })
  }, [employees, deptFilter, searchEmp, onlyAssignedFilter, empWeeklyStatsMap])

  const hasActiveFilters =
    searchEmp.trim() !== '' ||
    deptFilter !== 'Tất cả' ||
    shiftFilter !== 'Tất cả' ||
    statusFilter !== 'Đang hiệu lực' ||
    onlyAssignedFilter

  function resetAllFilters() {
    setSearchEmp('')
    setDeptFilter('Tất cả')
    setShiftFilter('Tất cả')
    setStatusFilter('Đang hiệu lực')
    setOnlyAssignedFilter(false)
  }

  /**
   * Hàm kiểm tra nghiệp vụ dùng chung cho Tạo đơn lẻ, Sửa, Sao chép tuần và Phân ca hàng loạt
   */
  function runAssignmentValidation(params: {
    employeeId: number
    shiftId: number
    workDate: string
    excludeAssignmentId?: number
    customExistingAssignments?: AssignmentForConflictCheck[]
  }): {
    valid: boolean
    errorMessage?: string
    warningMessage?: string
    dailyHours?: number
    weeklyHours?: number
  } {
    const {
      employeeId,
      shiftId,
      workDate,
      excludeAssignmentId,
      customExistingAssignments,
    } = params

    if (isLoading) {
      return {
        valid: false,
        errorMessage: 'Dữ liệu lịch đang được đồng bộ, vui lòng đợi trong giây lát.',
      }
    }

    const emp = employeeMap.get(employeeId)
    const shift = shiftMap.get(shiftId)

    if (!emp || !shift || !workDate) {
      return {
        valid: false,
        errorMessage: 'Dữ liệu nhân viên, ca làm hoặc ngày làm việc không tồn tại.',
      }
    }

    if (emp.status !== 'Đang hoạt động') {
      return {
        valid: false,
        errorMessage: `Nhân viên ${emp.name} hiện ở trạng thái "${emp.status}".`,
      }
    }

    const baseAssignments = customExistingAssignments || assignments

    const targetShiftDef: ShiftTimeDefinition = {
      id: shift.id,
      name: shift.name,
      start: shift.start,
      end: shift.end,
    }

    // 1. Kiểm tra trùng lặp khung giờ với ca khác của cùng nhân viên
    const timeConflict = findShiftTimeConflict({
      employeeId,
      targetShift: targetShiftDef,
      targetDate: workDate,
      existingAssignments: baseAssignments,
      shiftDefinitions: shiftDefMap,
      excludeAssignmentId,
    })
    if (timeConflict.hasConflict) {
      return { valid: false, errorMessage: `Trùng lịch: ${timeConflict.reason}` }
    }

    // 2. Kiểm tra đơn nghỉ phép đã phê duyệt
    try {
      const leaveConflict = checkLeaveConflict({
        employeeId,
        targetDate: workDate,
        targetShift: targetShiftDef,
        leaveRequests,
      })
      if (leaveConflict.hasConflict) {
        return { valid: false, errorMessage: `Nghỉ phép: ${leaveConflict.reason}` }
      }
    } catch (err: unknown) {
      return {
        valid: false,
        errorMessage:
          err instanceof Error ? err.message : 'Không thể xác minh dữ liệu nghỉ phép.',
      }
    }

    // 3. Tính toán tổng giờ làm trong ngày & trong tuần
    const hourCheck = calculateAndCheckWorkHours({
      employeeId,
      targetDate: workDate,
      targetShift: targetShiftDef,
      existingAssignments: baseAssignments,
      shiftDefinitions: shiftDefMap,
      excludeAssignmentId,
      policy: policyConfig,
    })

    if (hourCheck.blockingErrors.length > 0) {
      return {
        valid: false,
        errorMessage: hourCheck.blockingErrors.join(' '),
        dailyHours: hourCheck.dailyHours,
        weeklyHours: hourCheck.weeklyHours,
      }
    }

    // 4. Kiểm tra thời gian nghỉ giữa 2 ca
    const restCheck = checkMinRestBetweenShifts({
      employeeId,
      targetDate: workDate,
      targetShift: targetShiftDef,
      existingAssignments: baseAssignments,
      shiftDefinitions: shiftDefMap,
      excludeAssignmentId,
      policy: policyConfig,
    })

    if (restCheck.violatesMinRest && restCheck.isBlocking) {
      return {
        valid: false,
        errorMessage: restCheck.message,
        dailyHours: hourCheck.dailyHours,
        weeklyHours: hourCheck.weeklyHours,
      }
    }

    const warnings = [...hourCheck.warnings]
    if (restCheck.violatesMinRest && !restCheck.isBlocking && restCheck.message) {
      warnings.push(restCheck.message)
    }

    return {
      valid: true,
      warningMessage: warnings.join(' • '),
      dailyHours: hourCheck.dailyHours,
      weeklyHours: hourCheck.weeklyHours,
    }
  }

  // ============================================================================
  // CHỨC NĂNG 1 (PHASE 2A.4): SAO CHÉP LỊCH TUẦN TRƯỚC (COPY PREVIOUS WEEK)
  // ============================================================================
  const copyScheduleSimulation = useMemo(() => {
    if (!prevWeekStartIso || !prevWeekEndIso) {
      return { sourceCount: 0, validItems: [] as CandidateAssignmentItem[], skippedItems: [] as CandidateAssignmentItem[] }
    }

    // Lấy toàn bộ ca làm hợp lệ (không lấy ca Đã hủy) của tuần liền trước
    const prevWeekActive = assignments
      .filter(
        (a) =>
          a.workDate >= prevWeekStartIso &&
          a.workDate <= prevWeekEndIso &&
          a.status !== 'Đã hủy',
      )
      .sort((a, b) => a.workDate.localeCompare(b.workDate) || a.id - b.id)

    const simulatedExisting: AssignmentForConflictCheck[] = [...assignments]
    const validItems: CandidateAssignmentItem[] = []
    const skippedItems: CandidateAssignmentItem[] = []
    let tempIdCounter = -1000

    for (const src of prevWeekActive) {
      const targetWorkDate = addDaysToIsoDate(src.workDate, 7)
      const emp = employeeMap.get(src.employeeId)
      const shift = shiftMap.get(src.shiftId)

      const itemBase = {
        key: `copy-${src.id}-${targetWorkDate}`,
        employeeId: src.employeeId,
        employeeCode: emp?.code || `NV#${src.employeeId}`,
        employeeName: emp?.name || `Nhân viên #${src.employeeId}`,
        department: emp?.department || 'Chưa rõ',
        shiftId: src.shiftId,
        shiftName: shift?.name || `Ca #${src.shiftId}`,
        shiftTime: shift ? `${shift.start} – ${shift.end}` : '--:--',
        workDate: targetWorkDate,
        dayLabel: getWeekdayNameFromIso(targetWorkDate),
        status: (src.status === 'Dự kiến' ? 'Dự kiến' : 'Đã phân công') as 'Đã phân công' | 'Dự kiến',
        note: src.note || '',
      }

      // Kiểm tra xem bản ghi y hệt (Cùng NV + Cùng Ngày + Cùng Ca) đã tồn tại chưa
      const exactDuplicate = simulatedExisting.some(
        (ex) =>
          ex.employeeId === src.employeeId &&
          ex.workDate === targetWorkDate &&
          ex.shiftId === src.shiftId &&
          ex.status !== 'Đã hủy',
      )

      if (exactDuplicate) {
        skippedItems.push({
          ...itemBase,
          isValid: false,
          reason: 'Ca làm việc này đã tồn tại sẵn trong tuần hiện tại (Bỏ qua để tránh trùng lặp).',
        })
        continue
      }

      const check = runAssignmentValidation({
        employeeId: src.employeeId,
        shiftId: src.shiftId,
        workDate: targetWorkDate,
        customExistingAssignments: simulatedExisting,
      })

      if (!check.valid) {
        skippedItems.push({
          ...itemBase,
          isValid: false,
          reason: check.errorMessage || 'Xung đột lịch hoặc nhân sự không hợp lệ.',
        })
      } else {
        validItems.push({
          ...itemBase,
          isValid: true,
          warning: check.warningMessage,
        })
        // Đưa vào danh sách mô phỏng để các ca tiếp theo kiểm tra luỹ kế chính xác
        simulatedExisting.push({
          id: tempIdCounter--,
          employeeId: src.employeeId,
          shiftId: src.shiftId,
          workDate: targetWorkDate,
          status: itemBase.status,
        })
      }
    }

    return {
      sourceCount: prevWeekActive.length,
      validItems,
      skippedItems,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    prevWeekStartIso,
    prevWeekEndIso,
    assignments,
    employeeMap,
    shiftMap,
    leaveRequests,
    policyConfig,
  ])

  function handleOpenCopyWeekModal() {
    if (!isAdmin) {
      onNotify('Chỉ Quản trị viên hoặc Quản lý mới có quyền sao chép lịch làm việc.')
      return
    }
    setIsCopyModalOpen(true)
  }

  async function executeBatchInsert(
    title: string,
    validCandidates: CandidateAssignmentItem[],
    preSkippedCandidates: CandidateAssignmentItem[],
    onCloseCurrentModal: () => void,
  ) {
    if (!isAdmin || isSaving || validCandidates.length === 0) return

    try {
      setIsSaving(true)
      const supabase = createClient()

      const payloadWithShiftName = validCandidates.map((item) => ({
        employee_id: item.employeeId,
        shift_id: item.shiftId,
        shift_name: item.shiftName,
        work_date: item.workDate,
        status: item.status,
        note: item.note.trim(),
      }))

      let { error } = await supabase.from('shift_assignments').insert(payloadWithShiftName)

      if (error && error.message.includes('shift_name') && error.message.includes('does not exist')) {
        const payloadWithoutName = validCandidates.map((item) => ({
          employee_id: item.employeeId,
          shift_id: item.shiftId,
          work_date: item.workDate,
          status: item.status,
          note: item.note.trim(),
        }))
        const retry = await supabase.from('shift_assignments').insert(payloadWithoutName)
        error = retry.error
      }

      // Nếu batch insert thành công ngay lập tức
      if (!error) {
        onCloseCurrentModal()
        await onRefresh()
        setBatchSummary({
          title,
          totalAttempted: validCandidates.length + preSkippedCandidates.length,
          succeededCount: validCandidates.length,
          skippedCount: preSkippedCandidates.length,
          failedCount: 0,
          details: [
            `Đã lưu thành công ${validCandidates.length} lượt phân công vào lịch.`,
            ...preSkippedCandidates.map(
              (s) =>
                `[Bỏ qua] ${s.employeeName} (${formatIsoToShort(s.workDate)} - ${s.shiftName}): ${s.reason}`,
            ),
          ],
        })
        onNotify(`Đã lưu thành công ${validCandidates.length} ca làm việc mới.`)
        return
      }

      // Fallback: Nếu batch insert gặp lỗi ràng buộc đơn lẻ từ DB, chạy từng bản ghi để lưu tối đa các ca hợp lệ
      let succeeded = 0
      let failed = 0
      const detailLogs: string[] = []

      for (const item of validCandidates) {
        let singleRes = await supabase.from('shift_assignments').insert([
          {
            employee_id: item.employeeId,
            shift_id: item.shiftId,
            shift_name: item.shiftName,
            work_date: item.workDate,
            status: item.status,
            note: item.note.trim(),
          },
        ])

        if (
          singleRes.error &&
          singleRes.error.message.includes('shift_name') &&
          singleRes.error.message.includes('does not exist')
        ) {
          singleRes = await supabase.from('shift_assignments').insert([
            {
              employee_id: item.employeeId,
              shift_id: item.shiftId,
              work_date: item.workDate,
              status: item.status,
              note: item.note.trim(),
            },
          ])
        }

        if (singleRes.error) {
          failed += 1
          detailLogs.push(
            `[Lỗi DB] ${item.employeeName} (${formatIsoToShort(item.workDate)} - ${item.shiftName}): ${singleRes.error.message}`,
          )
        } else {
          succeeded += 1
        }
      }

      for (const s of preSkippedCandidates) {
        detailLogs.push(
          `[Bỏ qua] ${s.employeeName} (${formatIsoToShort(s.workDate)} - ${s.shiftName}): ${s.reason}`,
        )
      }

      onCloseCurrentModal()
      await onRefresh()
      setBatchSummary({
        title,
        totalAttempted: validCandidates.length + preSkippedCandidates.length,
        succeededCount: succeeded,
        skippedCount: preSkippedCandidates.length,
        failedCount: failed,
        details: detailLogs,
      })

      if (succeeded > 0) {
        onNotify(`Hoàn tất: ${succeeded} thành công, ${preSkippedCandidates.length} bỏ qua, ${failed} lỗi.`)
      }
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Lỗi kết nối mạng khi xử lý hàng loạt.')
    } finally {
      setIsSaving(false)
    }
  }

  // ============================================================================
  // CHỨC NĂNG 2 (PHASE 2A.4): PHÂN CA HÀNG LOẠT (BULK ASSIGNMENT)
  // ============================================================================
  function handleOpenBulkModal() {
    if (!isAdmin) {
      onNotify('Chỉ Quản trị viên hoặc Quản lý mới có quyền phân ca hàng loạt.')
      return
    }
    const activeEmps = employees.filter((e) => e.status === 'Đang hoạt động')
    if (activeEmps.length === 0 || shifts.length === 0) {
      onNotify('Cần có ít nhất 1 nhân viên đang hoạt động và 1 mẫu ca làm.')
      return
    }

    setBulkSelectedEmpIds([])
    // Mặc định chọn Thứ 2 -> Thứ 6 của tuần hiện tại
    setBulkSelectedDates(weekDays.slice(0, 5).map((d) => d.isoDate))
    setBulkShiftId(shifts[0].id)
    setBulkStatus('Đã phân công')
    setBulkNote('')
    setBulkDeptFilter('Tất cả')
    setBulkEmpSearch('')
    setIsBulkModalOpen(true)
  }

  const bulkSelectableEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (emp.status !== 'Đang hoạt động') return false
      const matchDept = bulkDeptFilter === 'Tất cả' || emp.department === bulkDeptFilter
      const q = bulkEmpSearch.trim().toLowerCase()
      const matchSearch =
        !q ||
        emp.name.toLowerCase().includes(q) ||
        emp.code.toLowerCase().includes(q) ||
        emp.role.toLowerCase().includes(q)
      return matchDept && matchSearch
    })
  }, [employees, bulkDeptFilter, bulkEmpSearch])

  const bulkSimulation = useMemo(() => {
    const validItems: CandidateAssignmentItem[] = []
    const skippedItems: CandidateAssignmentItem[] = []

    const selectedShift = shiftMap.get(bulkShiftId)
    if (!selectedShift || bulkSelectedEmpIds.length === 0 || bulkSelectedDates.length === 0) {
      return { validItems, skippedItems }
    }

    const sortedDates = [...bulkSelectedDates].sort()
    const simulatedExisting: AssignmentForConflictCheck[] = [...assignments]
    let tempIdCounter = -5000

    for (const empId of bulkSelectedEmpIds) {
      const emp = employeeMap.get(empId)
      if (!emp) continue

      for (const dateIso of sortedDates) {
        const itemBase = {
          key: `bulk-${empId}-${dateIso}-${selectedShift.id}`,
          employeeId: empId,
          employeeCode: emp.code,
          employeeName: emp.name,
          department: emp.department,
          shiftId: selectedShift.id,
          shiftName: selectedShift.name,
          shiftTime: `${selectedShift.start} – ${selectedShift.end}`,
          workDate: dateIso,
          dayLabel: getWeekdayNameFromIso(dateIso),
          status: bulkStatus,
          note: bulkNote,
        }

        const check = runAssignmentValidation({
          employeeId: empId,
          shiftId: selectedShift.id,
          workDate: dateIso,
          customExistingAssignments: simulatedExisting,
        })

        if (!check.valid) {
          skippedItems.push({
            ...itemBase,
            isValid: false,
            reason: check.errorMessage || 'Xung đột lịch hoặc vi phạm quy định giờ công.',
          })
        } else {
          validItems.push({
            ...itemBase,
            isValid: true,
            warning: check.warningMessage,
          })
          simulatedExisting.push({
            id: tempIdCounter--,
            employeeId: empId,
            shiftId: selectedShift.id,
            workDate: dateIso,
            status: bulkStatus,
          })
        }
      }
    }

    return { validItems, skippedItems }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bulkSelectedEmpIds,
    bulkSelectedDates,
    bulkShiftId,
    bulkStatus,
    bulkNote,
    assignments,
    shiftMap,
    employeeMap,
    leaveRequests,
    policyConfig,
  ])

  function toggleBulkEmployee(empId: number) {
    setBulkSelectedEmpIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId],
    )
  }

  function toggleBulkDate(dateIso: string) {
    setBulkSelectedDates((prev) =>
      prev.includes(dateIso) ? prev.filter((d) => d !== dateIso) : [...prev, dateIso],
    )
  }

  // ============================================================================
  // CHỨC NĂNG 3 (PHASE 2A.4): XUẤT CSV AN TOÀN & IN LỊCH TUẦN
  // ============================================================================
  function handleExportScheduleCsv() {
    if (!weekStartIso || !weekEndIso) {
      onNotify('Chưa xác định được khoảng ngày của tuần cần xuất.')
      return
    }

    const filteredEmpIds = new Set(filteredEmployees.map((e) => e.id))
    const rowsToExport: {
      workDate: string
      dayName: string
      empCode: string
      empName: string
      department: string
      role: string
      shiftName: string
      startTime: string
      endTime: string
      durationHours: string
      status: string
      note: string
    }[] = []

    const sortedWeekAssigns = [...weekAssignments].sort(
      (a, b) => a.workDate.localeCompare(b.workDate) || a.employeeId - b.employeeId,
    )

    for (const assign of sortedWeekAssigns) {
      if (!filteredEmpIds.has(assign.employeeId)) continue
      if (shiftFilter !== 'Tất cả' && String(assign.shiftId) !== shiftFilter) continue
      if (statusFilter === 'Đang hiệu lực' && assign.status === 'Đã hủy') continue
      if (
        statusFilter !== 'Tất cả' &&
        statusFilter !== 'Đang hiệu lực' &&
        assign.status !== statusFilter
      ) {
        continue
      }

      const emp = employeeMap.get(assign.employeeId)
      const shift = shiftMap.get(assign.shiftId)
      if (!emp) continue

      const startStr = shift?.start || '--:--'
      const endStr = shift?.end || '--:--'
      const dur = shift ? `${computeShiftDurationHours(shift.start, shift.end)}h` : '0h'

      rowsToExport.push({
        workDate: assign.workDate,
        dayName: getWeekdayNameFromIso(assign.workDate),
        empCode: emp.code,
        empName: emp.name,
        department: emp.department,
        role: emp.role,
        shiftName: shift?.name || `Ca #${assign.shiftId}`,
        startTime: startStr,
        endTime: endStr,
        durationHours: dur,
        status: assign.status,
        note: assign.note || '',
      })
    }

    if (rowsToExport.length === 0) {
      onNotify('Không có dữ liệu phân công ca nào trong tuần khớp với bộ lọc hiện tại để xuất CSV.')
      return
    }

    try {
      const headers = [
        'Ngày làm việc',
        'Thứ',
        'Mã nhân viên',
        'Họ và tên',
        'Phòng ban',
        'Chức vụ',
        'Mẫu ca làm việc',
        'Giờ bắt đầu',
        'Giờ kết thúc',
        'Thời lượng ca',
        'Trạng thái phân công',
        'Ghi chú',
      ]

      const csvLines = [
        headers.map(sanitizeAndEscapeCsvCell).join(','),
        ...rowsToExport.map((r) =>
          [
            r.workDate,
            r.dayName,
            r.empCode,
            r.empName,
            r.department,
            r.role,
            r.shiftName,
            r.startTime,
            r.endTime,
            r.durationHours,
            r.status,
            r.note,
          ]
            .map(sanitizeAndEscapeCsvCell)
            .join(','),
        ),
      ]

      const csvContent = '\uFEFF' + csvLines.join('\r\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const fileName = `ShiftFlow_LichTuan_${weekStartIso}_den_${weekEndIso}.csv`

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      onNotify(`Đã xuất ${rowsToExport.length} ca làm việc ra tệp ${fileName}.`)
    } catch {
      onNotify('Đã xảy ra lỗi khi tạo tệp CSV.')
    }
  }

  function handlePrintSchedule() {
    if (typeof window === 'undefined') return
    // Nếu đang ở chế độ xem ngày trên mobile, tự động chuyển sang lưới 7 ngày khi in rồi trả lại
    const previousMode = viewMode
    if (previousMode !== 'week') {
      setViewMode('week')
      setTimeout(() => {
        window.print()
        setViewMode(previousMode)
      }, 150)
    } else {
      window.print()
    }
  }

  // ============================================================================
  // CÁC THAO TÁC ĐƠN LẺ (GIỮ NGUYÊN TỪ PHASE 2A.3)
  // ============================================================================
  function openCreateModal(empId?: number, dateIso?: string, defaultShiftId?: number) {
    if (!isAdmin) {
      onNotify('Chỉ Quản trị viên hoặc Quản lý mới có quyền phân công lịch làm việc.')
      return
    }
    const activeEmps = employees.filter((e) => e.status === 'Đang hoạt động')
    if (activeEmps.length === 0 || shifts.length === 0) {
      onNotify('Cần có ít nhất 1 nhân viên đang hoạt động và 1 mẫu ca làm trước khi phân công.')
      return
    }

    const chosenEmp =
      (empId ? activeEmps.find((e) => e.id === empId) : undefined) || activeEmps[0]
    const matchedShift =
      (defaultShiftId ? shifts.find((s) => s.id === defaultShiftId) : undefined) ||
      shifts.find((s) => s.name === chosenEmp.shift) ||
      shifts[0]

    setCreateTarget({
      employeeId: chosenEmp.id,
      workDate: dateIso || selectedDayIso || todayIso || weekStartIso,
      shiftId: matchedShift.id,
      status: 'Đã phân công',
      note: '',
    })
  }

  function openEditModal(assign: ShiftAssignment) {
    setEditTarget({
      id: assign.id,
      employeeId: assign.employeeId,
      workDate: assign.workDate,
      shiftId: assign.shiftId,
      status: assign.status,
      note: assign.note || '',
      createdAt: assign.createdAt,
    })
  }

  const createLivePreview = useMemo(() => {
    if (!createTarget) return null
    return runAssignmentValidation({
      employeeId: createTarget.employeeId,
      shiftId: createTarget.shiftId,
      workDate: createTarget.workDate,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createTarget, assignments, leaveRequests, shifts])

  const editLivePreview = useMemo(() => {
    if (!editTarget || editTarget.status === 'Đã hủy') return null
    return runAssignmentValidation({
      employeeId: editTarget.employeeId,
      shiftId: editTarget.shiftId,
      workDate: editTarget.workDate,
      excludeAssignmentId: editTarget.id,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget, assignments, leaveRequests, shifts])

  async function handleCreateAssignmentSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isAdmin || !createTarget) return

    const { employeeId, shiftId, workDate, status, note } = createTarget
    const validation = runAssignmentValidation({ employeeId, shiftId, workDate })

    if (!validation.valid) {
      setFormValidationWarning(validation.errorMessage || 'Phân công không hợp lệ.')
      return
    }

    const shift = shiftMap.get(shiftId)
    const emp = employeeMap.get(employeeId)
    if (!shift || !emp) {
      setFormValidationWarning('Không tìm thấy thông tin nhân viên hoặc mẫu ca làm.')
      return
    }

    try {
      setIsSaving(true)
      setFormValidationWarning('')
      const supabase = createClient()

      let { error } = await supabase.from('shift_assignments').insert([
        {
          employee_id: employeeId,
          shift_id: shiftId,
          shift_name: shift.name,
          work_date: workDate,
          status,
          note: note.trim(),
        },
      ])

      if (error && error.message.includes('shift_name') && error.message.includes('does not exist')) {
        const retry = await supabase.from('shift_assignments').insert([
          {
            employee_id: employeeId,
            shift_id: shiftId,
            work_date: workDate,
            status,
            note: note.trim(),
          },
        ])
        error = retry.error
      }

      if (error) {
        setFormValidationWarning(`Không thể lưu phân công: ${error.message}`)
        return
      }

      setCreateTarget(null)
      let msg = `Đã phân công ${shift.name} (${formatIsoToShort(workDate)}) cho ${emp.name}.`
      if (validation.warningMessage) {
        msg += ` (Lưu ý: ${validation.warningMessage})`
      }
      onNotify(msg)
      await onRefresh()
    } catch (err: unknown) {
      setFormValidationWarning(
        err instanceof Error ? err.message : 'Lỗi kết nối mạng khi lưu phân công.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdateAssignmentSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isAdmin || !editTarget) return

    const { id, employeeId, shiftId, workDate, status, note } = editTarget

    if (status !== 'Đã hủy') {
      const validation = runAssignmentValidation({
        employeeId,
        shiftId,
        workDate,
        excludeAssignmentId: id,
      })
      if (!validation.valid) {
        setFormValidationWarning(validation.errorMessage || 'Xung đột khi cập nhật phân công.')
        return
      }
    }

    const shift = shiftMap.get(shiftId)
    if (!shift) {
      setFormValidationWarning('Mẫu ca làm việc không tồn tại.')
      return
    }

    try {
      setIsSaving(true)
      setFormValidationWarning('')
      const supabase = createClient()

      let { error } = await supabase
        .from('shift_assignments')
        .update({
          employee_id: employeeId,
          shift_id: shiftId,
          shift_name: shift.name,
          work_date: workDate,
          status,
          note: note.trim(),
        })
        .eq('id', id)

      if (error && error.message.includes('shift_name') && error.message.includes('does not exist')) {
        const retry = await supabase
          .from('shift_assignments')
          .update({
            employee_id: employeeId,
            shift_id: shiftId,
            work_date: workDate,
            status,
            note: note.trim(),
          })
          .eq('id', id)
        error = retry.error
      }

      if (error) {
        setFormValidationWarning(`Lỗi cập nhật: ${error.message}`)
        return
      }

      setEditTarget(null)
      onNotify('Đã cập nhật thông tin phân công ca làm việc.')
      await onRefresh()
    } catch (err: unknown) {
      setFormValidationWarning(
        err instanceof Error ? err.message : 'Lỗi kết nối khi cập nhật phân công.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCancelAssignment(assignmentId: number) {
    if (!isAdmin) return
    try {
      setIsSaving(true)
      const supabase = createClient()
      const { error } = await supabase
        .from('shift_assignments')
        .update({ status: 'Đã hủy' })
        .eq('id', assignmentId)

      if (error) {
        setFormValidationWarning(`Không thể hủy phân công: ${error.message}`)
        return
      }

      setEditTarget(null)
      onNotify('Đã chuyển trạng thái phân công sang Đã hủy.')
      await onRefresh()
    } catch {
      setFormValidationWarning('Lỗi kết nối khi hủy phân công.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteAssignment(assignmentId: number) {
    if (!isAdmin) return
    try {
      setIsSaving(true)
      const supabase = createClient()
      const { error } = await supabase.from('shift_assignments').delete().eq('id', assignmentId)

      if (error) {
        setFormValidationWarning(`Không thể xóa bản ghi: ${error.message}`)
        return
      }

      setEditTarget(null)
      onNotify('Đã xóa phân công khỏi lịch làm việc.')
      await onRefresh()
    } catch {
      setFormValidationWarning('Lỗi kết nối khi xóa bản ghi phân công.')
    } finally {
      setIsSaving(false)
    }
  }

  function getFilteredCellAssignments(empId: number, dateIso: string): ShiftAssignment[] {
    return weekAssignments.filter((a) => {
      if (a.employeeId !== empId || a.workDate !== dateIso) return false
      if (shiftFilter !== 'Tất cả' && String(a.shiftId) !== shiftFilter) return false
      if (statusFilter === 'Đang hiệu lực') return a.status !== 'Đã hủy'
      if (statusFilter !== 'Tất cả') return a.status === statusFilter
      return true
    })
  }

  function getApprovedLeaveForDay(empId: number, dateIso: string): LeaveRequestRecord | undefined {
    const sampleShift: ShiftTimeDefinition = { id: 0, name: 'Check', start: '08:00', end: '17:00' }
    try {
      const res = checkLeaveConflict({
        employeeId: empId,
        targetDate: dateIso,
        targetShift: sampleShift,
        leaveRequests,
      })
      return res.hasConflict ? res.conflictingLeave : undefined
    } catch {
      return undefined
    }
  }

  return (
    <div className="sf-schedule-module-root">
      {/* CSS CHUYÊN BIỆT CHO CHẾ ĐỘ IN LỊCH TUẦN (@media print) */}
      <style>{`
        .sf-print-only-header,
        .sf-print-only-footer {
          display: none;
        }
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .sidebar,
          .topbar,
          .page-heading,
          .dashboard-footer,
          .toast,
          .sf-no-print,
          dialog {
            display: none !important;
          }
          .dashboard,
          .main-shell,
          .dashboard-content {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
            background: #ffffff !important;
          }
          .panel {
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .data-table-wrap {
            overflow: visible !important;
          }
          .data-table {
            min-width: 100% !important;
            width: 100% !important;
            font-size: 11px !important;
            border-collapse: collapse !important;
          }
          .data-table th,
          .data-table td {
            position: static !important;
            border: 1px solid #cbd5e1 !important;
            padding: 6px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .sf-print-only-header {
            display: flex !important;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f766e;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }
          .sf-print-only-footer {
            display: flex !important;
            justify-content: space-between;
            margin-top: 22px;
            padding-top: 12px;
            font-size: 12px;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* TIÊU ĐỀ CHỈ HIỂN THỊ KHI IN ẤN */}
      <div className="sf-print-only-header">
        <div>
          <h1 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>
            BẢNG PHÂN CÔNG LỊCH LÀM VIỆC TUẦN
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#334155' }}>
            Chu kỳ tuần:{' '}
            <strong>
              {weekStartIso && weekEndIso
                ? `${formatIsoToVN(weekStartIso)} – ${formatIsoToVN(weekEndIso)}`
                : ''}
            </strong>{' '}
            · Phòng ban: <strong>{deptFilter}</strong> · Trạng thái: <strong>{statusFilter}</strong>
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11.5, color: '#475569' }}>
          <strong>ShiftFlow Enterprise</strong>
          <div>Ngày in: {todayIso ? formatIsoToVN(todayIso) : ''}</div>
          <div>
            Tổng số: {filteredEmployees.length} nhân sự · {weekSummaryStats.totalActive} ca
          </div>
        </div>
      </div>

      {/* 1. THANH CHỈ SỐ TỔNG QUAN LỊCH TUẦN (ẨN KHI IN) */}
      <section
        className="metrics-grid sf-no-print"
        style={{ marginBottom: 18 }}
        aria-label="Thống kê lịch tuần"
      >
        <article className="metric-card">
          <div className="metric-top">
            <span>Tổng ca đang hiệu lực</span>
            <span className="metric-icon teal" style={{ fontWeight: 700, fontSize: 13 }}>
              CA
            </span>
          </div>
          <strong className="metric-value">
            {isLoading ? '...' : weekSummaryStats.totalActive}
          </strong>
          <p>
            {weekSummaryStats.officialCount} chính thức · {weekSummaryStats.draftCount} dự kiến
          </p>
          <div className="metric-foot teal">
            <span className="tiny-dot" />
            {weekSummaryStats.cancelledCount > 0
              ? `${weekSummaryStats.cancelledCount} ca đã hủy trong tuần`
              : 'Không có ca hủy trong tuần'}
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-top">
            <span>Nhân sự đã xếp lịch</span>
            <span className="metric-icon blue" style={{ fontWeight: 700, fontSize: 13 }}>
              NV
            </span>
          </div>
          <strong className="metric-value">
            {isLoading ? '...' : `${weekSummaryStats.assignedEmployeeCount}/${employees.length}`}
          </strong>
          <p>Nhân viên có ít nhất 1 ca làm trong tuần</p>
          <div className="metric-foot blue">
            <span className="tiny-dot" />
            {employees.length - weekSummaryStats.assignedEmployeeCount} nhân sự chưa phân ca
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-top">
            <span>Tổng thời lượng phân ca</span>
            <span className="metric-icon purple" style={{ fontWeight: 700, fontSize: 13 }}>
              GIỜ
            </span>
          </div>
          <strong className="metric-value">
            {isLoading ? '...' : `${weekSummaryStats.totalScheduledHours}h`}
          </strong>
          <p>Tính theo khung giờ mẫu ca trong tuần</p>
          <div className="metric-foot purple">
            <span className="tiny-dot" />
            {weekSummaryStats.overnightCount} lượt ca qua đêm (+1 ngày)
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-top">
            <span>Lịch tuần liền trước</span>
            <span className="metric-icon orange" style={{ fontWeight: 700, fontSize: 13 }}>
              SAO CHÉP
            </span>
          </div>
          <strong className="metric-value">
            {isLoading ? '...' : `${copyScheduleSimulation.sourceCount} ca`}
          </strong>
          <p>
            {prevWeekStartIso && prevWeekEndIso
              ? `Tuần ${formatIsoToShort(prevWeekStartIso)} – ${formatIsoToShort(prevWeekEndIso)}`
              : 'Tuần liền trước'}
          </p>
          <div className="metric-foot orange">
            {isAdmin ? (
              <button
                type="button"
                onClick={handleOpenCopyWeekModal}
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
                Sao chép sang tuần này →
              </button>
            ) : (
              <span>Dữ liệu tham chiếu</span>
            )}
          </div>
        </article>
      </section>

      {/* 2. DANH MỤC MẪU CA LÀM VIỆC (ẨN KHI IN) */}
      <section className="panel sf-no-print" style={{ marginBottom: 18 }}>
        <div className="panel-heading" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>Danh mục mẫu ca làm việc</h2>
            <p>
              Nhấn vào từng thẻ mẫu ca bên dưới để lọc nhanh trên bảng lịch tuần.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              className="secondary-button"
              onClick={onOpenCreateShiftTemplate}
            >
              + Thêm mẫu ca
            </button>
          )}
        </div>

        {shifts.length === 0 ? (
          <div className="table-note">Chưa có mẫu ca làm việc nào được cấu hình.</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
              padding: '14px 22px 18px',
            }}
          >
            {shifts.map((s) => {
              const assignedInWeekCount = weekAssignments.filter(
                (a) => a.shiftId === s.id && a.status !== 'Đã hủy',
              ).length
              const overnight = isOvernightShift(s.start, s.end)
              const duration = computeShiftDurationHours(s.start, s.end)
              const palette = getShiftPalette(s.start, s.end, 'Đã phân công')
              const isSelectedFilter = shiftFilter === String(s.id)

              return (
                <div
                  key={s.id}
                  onClick={() =>
                    setShiftFilter(isSelectedFilter ? 'Tất cả' : String(s.id))
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setShiftFilter(isSelectedFilter ? 'Tất cả' : String(s.id))
                    }
                  }}
                  title="Nhấn để lọc lịch theo mẫu ca này"
                  style={{
                    borderRadius: 12,
                    border: `1.5px solid ${isSelectedFilter ? palette.accent : palette.border}`,
                    background: isSelectedFilter ? palette.bg : '#ffffff',
                    padding: '12px 14px',
                    borderLeft: `5px solid ${palette.accent}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelectedFilter
                      ? '0 4px 12px rgba(15, 118, 110, 0.1)'
                      : 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <strong style={{ fontSize: 14, color: palette.text }}>{s.name}</strong>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 99,
                        background: palette.badgeBg,
                        color: palette.badgeText,
                      }}
                    >
                      {duration}h {overnight ? '· Qua đêm' : ''}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
                    Khung giờ: <strong>{s.start}</strong> – <strong>{s.end}</strong>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: '#64748b',
                      borderTop: '1px dashed #e2e8f0',
                      paddingTop: 8,
                    }}
                  >
                    <span>Định biên: {s.count} người</span>
                    <strong style={{ color: palette.subtext }}>
                      {assignedInWeekCount} ca trong tuần
                    </strong>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 3. BẢNG ĐIỀU KHIỂN & LỊCH PHÂN CÔNG TUẦN */}
      <section className="panel">
        {/* Header điều hướng tuần & Các công cụ thông minh Phase 2A.4 (Ẩn khi in) */}
        <div
          className="panel-heading sf-no-print"
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
                Lịch làm việc tuần{' '}
                {weekStartIso && weekEndIso
                  ? `${formatIsoToVN(weekStartIso)} – ${formatIsoToVN(weekEndIso)}`
                  : ''}
              </h2>
              {weekDays.some((d) => d.isToday) && (
                <span className="badge success" style={{ fontSize: 11 }}>
                  Tuần hiện tại
                </span>
              )}
            </div>
            <p style={{ marginTop: 4 }}>
              Hỗ trợ sao chép lịch tuần trước, phân ca hàng loạt, xuất báo cáo CSV và in bảng phân công.
            </p>
          </div>

          {/* Cụm nút điều hướng tuần */}
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
                onClick={() => setViewMode('week')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewMode === 'week' ? '#ffffff' : 'transparent',
                  color: viewMode === 'week' ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === 'week' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                Lưới 7 ngày
              </button>
              <button
                type="button"
                onClick={() => setViewMode('day')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewMode === 'day' ? '#ffffff' : 'transparent',
                  color: viewMode === 'day' ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === 'day' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                Theo ngày (Mobile)
              </button>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setWeekMondayIso(addDaysToIsoDate(weekMondayIso, -7))}
            >
              ← Tuần trước
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                if (todayIso) {
                  setWeekMondayIso(getMondayOfIsoDate(todayIso))
                  setSelectedDayIso(todayIso)
                }
              }}
            >
              Hôm nay
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setWeekMondayIso(addDaysToIsoDate(weekMondayIso, 7))}
            >
              Tuần sau →
            </button>
            <input
              type="date"
              value={weekMondayIso}
              onChange={(e) =>
                e.target.value && setWeekMondayIso(getMondayOfIsoDate(e.target.value))
              }
              aria-label="Chọn ngày bất kỳ để chuyển tuần"
              style={{
                padding: '7px 10px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 13,
              }}
            />
          </div>
        </div>

        {/* Thanh tác vụ thông minh Phase 2A.4: Sao chép tuần, Phân ca hàng loạt, Xuất CSV, In lịch */}
        <div
          className="sf-no-print"
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
            {isAdmin && (
              <>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => openCreateModal()}
                >
                  + Phân ca đơn lẻ
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleOpenBulkModal}
                  style={{
                    borderColor: '#0d9488',
                    color: '#0f766e',
                    background: '#f0fdfa',
                    fontWeight: 600,
                  }}
                >
                  + Phân ca hàng loạt
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleOpenCopyWeekModal}
                >
                  Sao chép lịch tuần trước ({copyScheduleSimulation.sourceCount})
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={handleExportScheduleCsv}
              title="Xuất lịch tuần đang xem ra tệp CSV chuẩn Excel"
            >
              ↓ Xuất CSV tuần
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handlePrintSchedule}
              title="In bảng phân công lịch tuần (A4 Ngang)"
            >
              ⎙ In lịch tuần
            </button>
          </div>
        </div>

        {/* Thanh bộ lọc đa tiêu chí (Ẩn khi in) */}
        <div
          className="module-toolbar sf-no-print"
          style={{
            flexWrap: 'wrap',
            gap: 10,
            paddingBottom: 14,
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div className="search-box" style={{ minWidth: 230, flex: '1 1 230px' }}>
            <input
              value={searchEmp}
              onChange={(e) => setSearchEmp(e.target.value)}
              placeholder="Tìm theo tên, mã NV (SF-...), chức vụ..."
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

            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              aria-label="Lọc theo mẫu ca"
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontSize: 13,
                background: shiftFilter !== 'Tất cả' ? '#f0fdfa' : '#ffffff',
              }}
            >
              <option value="Tất cả">Tất cả mẫu ca</option>
              {shifts.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name} ({s.start} – {s.end})
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Lọc theo trạng thái"
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontSize: 13,
              }}
            >
              <option value="Đang hiệu lực">Đang hiệu lực (Ẩn ca hủy)</option>
              <option value="Tất cả">Tất cả trạng thái</option>
              <option value="Đã phân công">Chính thức (Đã phân công)</option>
              <option value="Dự kiến">Dự kiến (Bản nháp)</option>
              <option value="Đã hủy">Chỉ ca Đã hủy</option>
            </select>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: onlyAssignedFilter ? '#f0fdfa' : '#ffffff',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={onlyAssignedFilter}
                onChange={(e) => setOnlyAssignedFilter(e.target.checked)}
              />
              Chỉ NV đã có lịch
            </label>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
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

        {/* Chú thích quy tắc màu sắc */}
        <div
          className="sf-no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            padding: '10px 22px',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            fontSize: 12,
            color: '#475569',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>Chú thích ca:</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: '#0d9488',
                  display: 'inline-block',
                }}
              />
              Ca sáng
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: '#0284c7',
                  display: 'inline-block',
                }}
              />
              Ca chiều
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: '#6366f1',
                  display: 'inline-block',
                }}
              />
              Ca tối / Qua đêm
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: '#f59e0b',
                  display: 'inline-block',
                }}
              />
              Dự kiến (Nháp)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: '#ef4444',
                  display: 'inline-block',
                }}
              />
              Nghỉ phép đã duyệt
            </span>
          </div>
          <span>
            Hiển thị <strong>{filteredEmployees.length}</strong> / {employees.length} nhân sự
          </span>
        </div>

        {/* NỘI DUNG BẢNG LỊCH */}
        {isLoading ? (
          <div className="table-note" style={{ padding: '40px 22px', textAlign: 'center' }}>
            Đang đồng bộ dữ liệu lịch phân công từ cơ sở dữ liệu...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="table-note" style={{ padding: '36px 22px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 10px', fontSize: 14 }}>
              Không tìm thấy nhân sự nào khớp với điều kiện lọc hiện tại.
            </p>
            {hasActiveFilters && (
              <button type="button" className="secondary-button" onClick={resetAllFilters}>
                Đặt lại bộ lọc
              </button>
            )}
          </div>
        ) : viewMode === 'week' ? (
          <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
            <table
              className="data-table"
              style={{ minWidth: 1040, borderCollapse: 'separate', borderSpacing: 0 }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      minWidth: 220,
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      background: '#f8fafc',
                      borderRight: '1px solid #e2e8f0',
                    }}
                  >
                    Nhân sự & Tổng giờ tuần
                  </th>
                  {weekDays.map((day) => {
                    const dayActiveCount = weekAssignments.filter(
                      (a) => a.workDate === day.isoDate && a.status !== 'Đã hủy',
                    ).length

                    return (
                      <th
                        key={day.isoDate}
                        style={{
                          minWidth: 132,
                          backgroundColor: day.isToday ? '#f0fdfa' : '#f8fafc',
                          borderBottom: day.isToday
                            ? '2px solid #0d9488'
                            : '1px solid #e2e8f0',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              color: day.isToday ? '#0f766e' : '#0f172a',
                              fontWeight: 700,
                            }}
                          >
                            {day.dayName}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: 99,
                              background: day.isToday ? '#ccfbf1' : '#e2e8f0',
                              color: day.isToday ? '#0f766e' : '#475569',
                            }}
                          >
                            {dayActiveCount} ca
                          </span>
                        </div>
                        <small
                          style={{
                            display: 'block',
                            color: day.isToday ? '#0d9488' : '#64748b',
                            fontWeight: 500,
                            marginTop: 2,
                          }}
                        >
                          {day.shortDate} {day.isToday ? '· Hôm nay' : ''}
                        </small>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => {
                  const empStats = empWeeklyStatsMap.get(emp.id) || { count: 0, hours: 0 }
                  const isOverWeeklyLimit =
                    policyConfig.maxWeeklyHours && empStats.hours > policyConfig.maxWeeklyHours

                  return (
                    <tr key={emp.id}>
                      <td
                        style={{
                          verticalAlign: 'top',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          background: '#ffffff',
                          borderRight: '1px solid #e2e8f0',
                          padding: '12px 14px',
                        }}
                      >
                        <div className="employee-cell">
                          <span className={`avatar ${emp.tone}`}>{emp.initials}</span>
                          <div>
                            <strong style={{ display: 'block', fontSize: 13.5 }}>
                              {emp.name}
                            </strong>
                            <small style={{ display: 'block', color: '#64748b' }}>
                              {emp.code} · {emp.department}
                            </small>
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                marginTop: 6,
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                background: isOverWeeklyLimit
                                  ? '#fef2f2'
                                  : empStats.count > 0
                                    ? '#f0fdfa'
                                    : '#f1f5f9',
                                color: isOverWeeklyLimit
                                  ? '#b91c1c'
                                  : empStats.count > 0
                                    ? '#0f766e'
                                    : '#64748b',
                              }}
                            >
                              <span>{empStats.count} ca</span>
                              <span>·</span>
                              <span>{empStats.hours}h</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {weekDays.map((day) => {
                        const cellAssignments = getFilteredCellAssignments(emp.id, day.isoDate)
                        const approvedLeave = getApprovedLeaveForDay(emp.id, day.isoDate)

                        return (
                          <td
                            key={day.isoDate}
                            style={{
                              verticalAlign: 'top',
                              backgroundColor: day.isToday ? '#f8fafc' : '#ffffff',
                              padding: '10px 8px',
                              borderRight: '1px solid #f1f5f9',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                                minHeight: 68,
                              }}
                            >
                              {approvedLeave && (
                                <div
                                  style={{
                                    padding: '5px 8px',
                                    borderRadius: 7,
                                    background: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    color: '#b91c1c',
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  Nghỉ phép đã duyệt
                                </div>
                              )}

                              {cellAssignments.map((assign) => {
                                const shiftObj = shiftMap.get(assign.shiftId)
                                const shiftTitle = shiftObj?.name || `Ca #${assign.shiftId}`
                                const startStr = shiftObj?.start || '08:00'
                                const endStr = shiftObj?.end || '12:00'
                                const overnight = isOvernightShift(startStr, endStr)
                                const palette = getShiftPalette(startStr, endStr, assign.status)

                                return (
                                  <button
                                    key={assign.id}
                                    type="button"
                                    onClick={() => openEditModal(assign)}
                                    title="Nhấn để xem chi tiết hoặc chỉnh sửa phân công"
                                    style={{
                                      textAlign: 'left',
                                      padding: '7px 9px',
                                      borderRadius: 8,
                                      border: `1px solid ${palette.border}`,
                                      borderLeft: `4px solid ${palette.accent}`,
                                      background: palette.bg,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 3,
                                      opacity: assign.status === 'Đã hủy' ? 0.65 : 1,
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 4,
                                      }}
                                    >
                                      <strong
                                        style={{
                                          fontSize: 12,
                                          color: palette.text,
                                          textDecoration:
                                            assign.status === 'Đã hủy' ? 'line-through' : 'none',
                                        }}
                                      >
                                        {shiftTitle}
                                      </strong>
                                      {assign.status !== 'Đã phân công' && (
                                        <span
                                          style={{
                                            fontSize: 9.5,
                                            fontWeight: 700,
                                            padding: '1px 5px',
                                            borderRadius: 4,
                                            background: palette.badgeBg,
                                            color: palette.badgeText,
                                          }}
                                        >
                                          {assign.status}
                                        </span>
                                      )}
                                    </div>

                                    <span
                                      style={{
                                        fontSize: 11,
                                        color: palette.subtext,
                                        fontWeight: 600,
                                      }}
                                    >
                                      {startStr} – {endStr}
                                      {overnight ? ' (+1d)' : ''}
                                    </span>

                                    {assign.note && (
                                      <small
                                        style={{
                                          fontSize: 10.5,
                                          color: '#475569',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          maxWidth: 118,
                                        }}
                                      >
                                        {assign.note}
                                      </small>
                                    )}
                                  </button>
                                )
                              })}

                              {cellAssignments.length === 0 && !approvedLeave && (
                                <span
                                  style={{
                                    fontSize: 11.5,
                                    color: '#cbd5e1',
                                    display: 'block',
                                    padding: '4px 2px',
                                  }}
                                >
                                  Trống
                                </span>
                              )}

                              {isAdmin && emp.status === 'Đang hoạt động' && !approvedLeave && (
                                <button
                                  type="button"
                                  className="sf-no-print"
                                  onClick={() => openCreateModal(emp.id, day.isoDate)}
                                  style={{
                                    marginTop: 'auto',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    border: '1px dashed #cbd5e1',
                                    background: '#ffffff',
                                    color: '#0f766e',
                                    cursor: 'pointer',
                                    alignSelf: 'flex-start',
                                  }}
                                >
                                  + Phân ca
                                </button>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* CHẾ ĐỘ XEM THEO NGÀY (MOBILE/TABLET) */
          <div style={{ padding: '16px 22px 22px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(42px, 1fr))',
                gap: 6,
                marginBottom: 18,
              }}
            >
              {weekDays.map((day) => {
                const isSelected = day.isoDate === selectedDayIso
                const countInDay = weekAssignments.filter(
                  (a) => a.workDate === day.isoDate && a.status !== 'Đã hủy',
                ).length

                return (
                  <button
                    key={day.isoDate}
                    type="button"
                    onClick={() => setSelectedDayIso(day.isoDate)}
                    style={{
                      padding: '8px 4px',
                      borderRadius: 10,
                      border: isSelected
                        ? '2px solid #0d9488'
                        : day.isToday
                          ? '1px solid #99f6e4'
                          : '1px solid #e2e8f0',
                      background: isSelected ? '#f0fdfa' : '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: isSelected ? '#0f766e' : '#64748b',
                      }}
                    >
                      {day.shortLabel}
                    </span>
                    <strong style={{ fontSize: 13, color: '#0f172a' }}>{day.shortDate}</strong>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '1px 5px',
                        borderRadius: 99,
                        background: countInDay > 0 ? '#ccfbf1' : '#f1f5f9',
                        color: countInDay > 0 ? '#0f766e' : '#94a3b8',
                      }}
                    >
                      {countInDay} ca
                    </span>
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {filteredEmployees.map((emp) => {
                const dayAssigns = getFilteredCellAssignments(emp.id, selectedDayIso)
                const approvedLeave = getApprovedLeaveForDay(emp.id, selectedDayIso)

                return (
                  <div
                    key={emp.id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div className="employee-cell">
                        <span className={`avatar ${emp.tone}`}>{emp.initials}</span>
                        <div>
                          <strong>{emp.name}</strong>
                          <small style={{ display: 'block', color: '#64748b' }}>
                            {emp.code} · {emp.department} · {emp.role}
                          </small>
                        </div>
                      </div>

                      {isAdmin && emp.status === 'Đang hoạt động' && !approvedLeave && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => openCreateModal(emp.id, selectedDayIso)}
                          style={{ padding: '6px 12px', fontSize: 12 }}
                        >
                          + Phân ca ngày {formatIsoToShort(selectedDayIso)}
                        </button>
                      )}
                    </div>

                    {approvedLeave && (
                      <div
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          color: '#b91c1c',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Nhân viên đang trong kỳ nghỉ phép đã phê duyệt ({approvedLeave.date_range}).
                      </div>
                    )}

                    {dayAssigns.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {dayAssigns.map((assign) => {
                          const shiftObj = shiftMap.get(assign.shiftId)
                          const startStr = shiftObj?.start || '08:00'
                          const endStr = shiftObj?.end || '12:00'
                          const palette = getShiftPalette(startStr, endStr, assign.status)

                          return (
                            <button
                              key={assign.id}
                              type="button"
                              onClick={() => openEditModal(assign)}
                              style={{
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: `1px solid ${palette.border}`,
                                borderLeft: `4px solid ${palette.accent}`,
                                background: palette.bg,
                                cursor: 'pointer',
                                textAlign: 'left',
                                flex: '1 1 220px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: 8,
                                }}
                              >
                                <strong style={{ fontSize: 13, color: palette.text }}>
                                  {shiftObj?.name || `Ca #${assign.shiftId}`}
                                </strong>
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    background: palette.badgeBg,
                                    color: palette.badgeText,
                                  }}
                                >
                                  {assign.status}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: palette.subtext, marginTop: 2 }}>
                                Khung giờ: <strong>{startStr} – {endStr}</strong>
                              </div>
                              {assign.note && (
                                <div style={{ fontSize: 11.5, color: '#475569', marginTop: 4 }}>
                                  Ghi chú: {assign.note}
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      !approvedLeave && (
                        <div style={{ fontSize: 12.5, color: '#94a3b8' }}>
                          Chưa có ca làm việc nào trong ngày {formatIsoToVN(selectedDayIso)}.
                        </div>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* CHÂN TRANG KÝ DUYỆT CHỈ HIỂN THỊ KHI IN ẤN */}
      <div className="sf-print-only-footer">
        <div style={{ textAlign: 'center', minWidth: 200 }}>
          <strong>NGƯỜI LẬP BIỂU</strong>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>(Ký và ghi rõ họ tên)</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: 200 }}>
          <strong>TRƯỞNG BỘ PHẬN / QUẢN LÝ</strong>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>(Ký duyệt)</div>
        </div>
      </div>

      {/* ==========================================================================
          HỘP THOẠI PHASE 2A.4: SAO CHÉP LỊCH TUẦN TRƯỚC (COPY WEEKLY SCHEDULE)
      ========================================================================== */}
      {isCopyModalOpen && (
        <dialog
          ref={copyDialogRef}
          className="dashboard-modal"
          style={{ width: 'min(720px, 95vw)' }}
          onCancel={() => !isSaving && setIsCopyModalOpen(false)}
          onClick={(e) => !isSaving && e.target === e.currentTarget && setIsCopyModalOpen(false)}
        >
          <div className="modal-heading">
            <h2>Sao chép lịch từ tuần trước</h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => !isSaving && setIsCopyModalOpen(false)}
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>

          <p className="modal-description" style={{ marginBottom: 14 }}>
            Sao chép từ tuần{' '}
            <strong>
              {formatIsoToVN(prevWeekStartIso)} – {formatIsoToVN(prevWeekEndIso)}
            </strong>{' '}
            sang tuần đang chọn{' '}
            <strong>
              {formatIsoToVN(weekStartIso)} – {formatIsoToVN(weekEndIso)}
            </strong>
            . Hệ thống giữ nguyên thứ trong tuần và không ghi đè lên các ca đã có.
          </p>

          {copyScheduleSimulation.sourceCount === 0 ? (
            <div
              style={{
                padding: '28px 18px',
                borderRadius: 10,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                textAlign: 'center',
                color: '#475569',
                marginBottom: 14,
              }}
            >
              <strong>Không có dữ liệu lịch ở tuần liền trước</strong>
              <p style={{ margin: '6px 0 0', fontSize: 13 }}>
                Tuần trước ({formatIsoToShort(prevWeekStartIso)} – {formatIsoToShort(prevWeekEndIso)}) chưa có ca làm việc nào đang hoạt động để sao chép.
              </p>
            </div>
          ) : (
            <>
              {/* Thẻ tóm tắt số lượng */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <small style={{ color: '#64748b', display: 'block' }}>Tổng ca tuần trước</small>
                  <strong style={{ fontSize: 18 }}>{copyScheduleSimulation.sourceCount}</strong>
                </div>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: '#f0fdfa',
                    border: '1px solid #99f6e4',
                  }}
                >
                  <small style={{ color: '#0f766e', display: 'block' }}>
                    Hợp lệ (Sẽ sao chép)
                  </small>
                  <strong style={{ fontSize: 18, color: '#0f766e' }}>
                    {copyScheduleSimulation.validItems.length}
                  </strong>
                </div>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background:
                      copyScheduleSimulation.skippedItems.length > 0 ? '#fffbeb' : '#f8fafc',
                    border: `1px solid ${copyScheduleSimulation.skippedItems.length > 0 ? '#fde68a' : '#e2e8f0'}`,
                  }}
                >
                  <small style={{ color: '#92400e', display: 'block' }}>
                    Bị bỏ qua (Trùng/Nghỉ)
                  </small>
                  <strong style={{ fontSize: 18, color: '#b45309' }}>
                    {copyScheduleSimulation.skippedItems.length}
                  </strong>
                </div>
              </div>

              {/* Danh sách chi tiết xem trước */}
              <div
                style={{
                  maxHeight: 280,
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: 10,
                  display: 'grid',
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                {copyScheduleSimulation.validItems.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: '#f0fdfa',
                      border: '1px solid #ccfbf1',
                      fontSize: 12.5,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <strong>
                        {item.employeeCode} – {item.employeeName}
                      </strong>{' '}
                      <span style={{ color: '#475569' }}>
                        ({item.dayLabel}, {formatIsoToShort(item.workDate)})
                      </span>
                      {item.warning && (
                        <div style={{ color: '#b45309', fontSize: 11.5, marginTop: 2 }}>
                          Lưu ý: {item.warning}
                        </div>
                      )}
                    </div>
                    <span className="badge success">
                      {item.shiftName} ({item.shiftTime})
                    </span>
                  </div>
                ))}

                {copyScheduleSimulation.skippedItems.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      fontSize: 12.5,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <strong>
                        {item.employeeCode} – {item.employeeName} ({item.dayLabel},{' '}
                        {formatIsoToShort(item.workDate)})
                      </strong>
                      <span className="badge warning">Bỏ qua: {item.shiftName}</span>
                    </div>
                    <div style={{ color: '#b91c1c', fontSize: 11.5, marginTop: 3 }}>
                      Lý do: {item.reason}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              className="secondary-button"
              disabled={isSaving}
              onClick={() => setIsCopyModalOpen(false)}
            >
              Đóng
            </button>
            {copyScheduleSimulation.validItems.length > 0 && (
              <button
                type="button"
                className="primary-button"
                disabled={isSaving}
                onClick={() =>
                  executeBatchInsert(
                    'Kết quả sao chép lịch tuần',
                    copyScheduleSimulation.validItems,
                    copyScheduleSimulation.skippedItems,
                    () => setIsCopyModalOpen(false),
                  )
                }
              >
                {isSaving
                  ? 'Đang sao chép...'
                  : `Xác nhận sao chép (${copyScheduleSimulation.validItems.length} ca)`}
              </button>
            )}
          </div>
        </dialog>
      )}

      {/* ==========================================================================
          HỘP THOẠI PHASE 2A.4: PHÂN CA HÀNG LOẠT (BULK ASSIGNMENT)
      ========================================================================== */}
      {isBulkModalOpen && (
        <dialog
          ref={bulkDialogRef}
          className="dashboard-modal"
          style={{ width: 'min(780px, 96vw)' }}
          onCancel={() => !isSaving && setIsBulkModalOpen(false)}
          onClick={(e) => !isSaving && e.target === e.currentTarget && setIsBulkModalOpen(false)}
        >
          <div className="modal-heading">
            <h2>Phân ca làm việc hàng loạt</h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => !isSaving && setIsBulkModalOpen(false)}
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>

          <div className="shift-form" style={{ gap: 14 }}>
            {/* Bước 1: Chọn mẫu ca, trạng thái và ghi chú */}
            <div className="form-split">
              <label>
                1. Chọn mẫu ca cần gán
                <select
                  value={bulkShiftId}
                  onChange={(e) => setBulkShiftId(Number(e.target.value))}
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.start} – {s.end} · {computeShiftDurationHours(s.start, s.end)}h)
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Trạng thái phân công
                <select
                  value={bulkStatus}
                  onChange={(e) =>
                    setBulkStatus(e.target.value as 'Đã phân công' | 'Dự kiến')
                  }
                >
                  <option value="Đã phân công">Đã phân công (Chính thức)</option>
                  <option value="Dự kiến">Dự kiến (Bản nháp)</option>
                </select>
              </label>
            </div>

            {/* Bước 2: Chọn các ngày áp dụng trong tuần */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  2. Chọn các ngày làm việc trong tuần ({bulkSelectedDates.length}/7 ngày)
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="pill-btn"
                    onClick={() =>
                      setBulkSelectedDates(weekDays.slice(0, 5).map((d) => d.isoDate))
                    }
                    style={{ fontSize: 11, padding: '3px 8px' }}
                  >
                    Thứ 2 – Thứ 6
                  </button>
                  <button
                    type="button"
                    className="pill-btn"
                    onClick={() => setBulkSelectedDates(weekDays.map((d) => d.isoDate))}
                    style={{ fontSize: 11, padding: '3px 8px' }}
                  >
                    Cả tuần (7 ngày)
                  </button>
                  <button
                    type="button"
                    className="pill-btn"
                    onClick={() => setBulkSelectedDates([])}
                    style={{ fontSize: 11, padding: '3px 8px' }}
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, minmax(44px, 1fr))',
                  gap: 6,
                }}
              >
                {weekDays.map((day) => {
                  const checked = bulkSelectedDates.includes(day.isoDate)
                  return (
                    <button
                      key={day.isoDate}
                      type="button"
                      onClick={() => toggleBulkDate(day.isoDate)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: 8,
                        border: checked ? '2px solid #0d9488' : '1px solid #cbd5e1',
                        background: checked ? '#f0fdfa' : '#ffffff',
                        color: checked ? '#0f766e' : '#475569',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <span>{day.shortLabel}</span>
                      <small style={{ fontSize: 11, fontWeight: 500 }}>{day.shortDate}</small>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Bước 3: Chọn nhiều nhân viên */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  3. Chọn nhân viên ({bulkSelectedEmpIds.length} người được chọn)
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <input
                    value={bulkEmpSearch}
                    onChange={(e) => setBulkEmpSearch(e.target.value)}
                    placeholder="Tìm tên/mã NV..."
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 12,
                    }}
                  />
                  <select
                    value={bulkDeptFilter}
                    onChange={(e) => setBulkDeptFilter(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 12,
                    }}
                  >
                    <option value="Tất cả">Tất cả phòng ban</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="pill-btn"
                    onClick={() => {
                      const visibleIds = bulkSelectableEmployees.map((e) => e.id)
                      setBulkSelectedEmpIds((prev) =>
                        Array.from(new Set([...prev, ...visibleIds])),
                      )
                    }}
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    className="pill-btn"
                    onClick={() => setBulkSelectedEmpIds([])}
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    Bỏ chọn hết
                  </button>
                </div>
              </div>

              <div
                style={{
                  maxHeight: 155,
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 8,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))',
                  gap: 6,
                }}
              >
                {bulkSelectableEmployees.map((emp) => {
                  const isChecked = bulkSelectedEmpIds.includes(emp.id)
                  return (
                    <label
                      key={emp.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: `1px solid ${isChecked ? '#0d9488' : '#e2e8f0'}`,
                        background: isChecked ? '#f0fdfa' : '#ffffff',
                        cursor: 'pointer',
                        fontSize: 12,
                        flexDirection: 'row',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleBulkEmployee(emp.id)}
                      />
                      <div style={{ overflow: 'hidden' }}>
                        <strong
                          style={{
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {emp.name}
                        </strong>
                        <small style={{ color: '#64748b' }}>
                          {emp.code} · {emp.department}
                        </small>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <label>
              Ghi chú áp dụng chung (Tùy chọn)
              <input
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                placeholder="Ví dụ: Lịch phân ca định kỳ tuần..."
                maxLength={120}
              />
            </label>

            {/* Bước 4: Xem trước kết quả kiểm tra xung đột trước khi xác nhận */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 8,
                  fontSize: 12.5,
                }}
              >
                <strong>4. Xem trước kiểm tra xung đột:</strong>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ color: '#0f766e', fontWeight: 700 }}>
                    ✓ Hợp lệ: {bulkSimulation.validItems.length} ca
                  </span>
                  <span style={{ color: '#b91c1c', fontWeight: 700 }}>
                    ✕ Bỏ qua do xung đột: {bulkSimulation.skippedItems.length} ca
                  </span>
                </div>
              </div>

              {bulkSimulation.validItems.length === 0 &&
              bulkSimulation.skippedItems.length === 0 ? (
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Vui lòng chọn ít nhất 1 nhân viên và 1 ngày làm việc để xem trước danh sách phân ca.
                </div>
              ) : (
                <div
                  style={{
                    maxHeight: 130,
                    overflowY: 'auto',
                    display: 'grid',
                    gap: 5,
                    fontSize: 12,
                  }}
                >
                  {bulkSimulation.skippedItems.map((item) => (
                    <div
                      key={item.key}
                      style={{
                        padding: '5px 8px',
                        borderRadius: 6,
                        background: '#fef2f2',
                        color: '#b91c1c',
                        border: '1px solid #fecaca',
                      }}
                    >
                      <strong>
                        [Bỏ qua] {item.employeeName} ({formatIsoToShort(item.workDate)}):
                      </strong>{' '}
                      {item.reason}
                    </div>
                  ))}
                  {bulkSimulation.validItems.map((item) => (
                    <div
                      key={item.key}
                      style={{
                        padding: '5px 8px',
                        borderRadius: 6,
                        background: '#f0fdfa',
                        color: '#0f766e',
                        border: '1px solid #ccfbf1',
                      }}
                    >
                      <strong>
                        [Hợp lệ] {item.employeeName} ({item.dayLabel},{' '}
                        {formatIsoToShort(item.workDate)})
                      </strong>{' '}
                      → {item.shiftName} ({item.shiftTime})
                      {item.warning ? ` · Lưu ý: ${item.warning}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="secondary-button"
                disabled={isSaving}
                onClick={() => setIsBulkModalOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={isSaving || bulkSimulation.validItems.length === 0}
                onClick={() =>
                  executeBatchInsert(
                    'Kết quả phân ca hàng loạt',
                    bulkSimulation.validItems,
                    bulkSimulation.skippedItems,
                    () => setIsBulkModalOpen(false),
                  )
                }
              >
                {isSaving
                  ? 'Đang xử lý...'
                  : `Xác nhận lưu (${bulkSimulation.validItems.length} ca hợp lệ)`}
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* ==========================================================================
          HỘP THOẠI BÁO CÁO KẾT QUẢ THỰC THI HÀNG LOẠT (SUMMARY REPORT)
      ========================================================================== */}
      {batchSummary && (
        <dialog
          ref={summaryDialogRef}
          className="dashboard-modal"
          style={{ width: 'min(620px, 95vw)' }}
          onCancel={() => setBatchSummary(null)}
          onClick={(e) => e.target === e.currentTarget && setBatchSummary(null)}
        >
          <div className="modal-heading">
            <h2>{batchSummary.title}</h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => setBatchSummary(null)}
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: '#f0fdfa',
                border: '1px solid #99f6e4',
              }}
            >
              <small style={{ color: '#0f766e', display: 'block' }}>Đã lưu thành công</small>
              <strong style={{ fontSize: 18, color: '#0f766e' }}>
                {batchSummary.succeededCount} ca
              </strong>
            </div>
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: '#fffbeb',
                border: '1px solid #fde68a',
              }}
            >
              <small style={{ color: '#92400e', display: 'block' }}>Bỏ qua do trùng/nghỉ</small>
              <strong style={{ fontSize: 18, color: '#b45309' }}>
                {batchSummary.skippedCount} ca
              </strong>
            </div>
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: batchSummary.failedCount > 0 ? '#fef2f2' : '#f8fafc',
                border: `1px solid ${batchSummary.failedCount > 0 ? '#fecaca' : '#e2e8f0'}`,
              }}
            >
              <small style={{ color: '#64748b', display: 'block' }}>Lỗi phát sinh</small>
              <strong
                style={{
                  fontSize: 18,
                  color: batchSummary.failedCount > 0 ? '#b91c1c' : '#475569',
                }}
              >
                {batchSummary.failedCount} ca
              </strong>
            </div>
          </div>

          <div
            style={{
              maxHeight: 240,
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 10,
              fontSize: 12.5,
              display: 'grid',
              gap: 6,
              marginBottom: 14,
            }}
          >
            {batchSummary.details.map((line, idx) => (
              <div key={idx} style={{ color: '#334155' }}>
                {line}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="primary-button"
              onClick={() => setBatchSummary(null)}
            >
              Hoàn tất
            </button>
          </div>
        </dialog>
      )}

      {/* ==========================================================================
          HỘP THOẠI TẠO MỚI ĐƠN LẺ & CHỈNH SỬA (GIỮ NGUYÊN TỪ PHASE 2A.3)
      ========================================================================== */}
      {createTarget && (
        <dialog
          ref={createDialogRef}
          className="dashboard-modal"
          onCancel={() => setCreateTarget(null)}
          onClick={(e) => e.target === e.currentTarget && setCreateTarget(null)}
        >
          <div className="modal-heading">
            <h2>Phân công ca làm việc</h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => setCreateTarget(null)}
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>

          {(formValidationWarning || (createLivePreview && !createLivePreview.valid)) && (
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
              <strong>Phát hiện xung đột:</strong>{' '}
              {formValidationWarning || createLivePreview?.errorMessage}
            </div>
          )}

          {createLivePreview?.valid && createLivePreview.warningMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                fontSize: 12.5,
                marginBottom: 12,
              }}
            >
              <strong>Lưu ý giờ công:</strong> {createLivePreview.warningMessage}
            </div>
          )}

          <form className="shift-form" onSubmit={handleCreateAssignmentSubmit}>
            <label>
              Nhân viên được phân công
              <select
                name="employeeId"
                value={createTarget.employeeId}
                onChange={(e) => {
                  setFormValidationWarning('')
                  setCreateTarget({
                    ...createTarget,
                    employeeId: Number(e.target.value),
                  })
                }}
                required
              >
                {employees.map((emp) => (
                  <option
                    key={emp.id}
                    value={emp.id}
                    disabled={emp.status !== 'Đang hoạt động'}
                  >
                    {emp.code} – {emp.name} ({emp.department})
                    {emp.status !== 'Đang hoạt động' ? ` [${emp.status}]` : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-split">
              <label>
                Ngày làm việc
                <input
                  type="date"
                  name="workDate"
                  value={createTarget.workDate}
                  onChange={(e) => {
                    setFormValidationWarning('')
                    setCreateTarget({ ...createTarget, workDate: e.target.value })
                  }}
                  required
                />
              </label>

              <label>
                Trạng thái phân công
                <select
                  name="status"
                  value={createTarget.status}
                  onChange={(e) =>
                    setCreateTarget({
                      ...createTarget,
                      status: e.target.value as 'Đã phân công' | 'Dự kiến',
                    })
                  }
                >
                  <option value="Đã phân công">Đã phân công (Chính thức)</option>
                  <option value="Dự kiến">Dự kiến (Bản nháp)</option>
                </select>
              </label>
            </div>

            <label>
              Chọn mẫu ca làm việc
              <select
                name="shiftId"
                value={createTarget.shiftId}
                onChange={(e) => {
                  setFormValidationWarning('')
                  setCreateTarget({
                    ...createTarget,
                    shiftId: Number(e.target.value),
                  })
                }}
                required
              >
                {shifts.map((s) => {
                  const dur = computeShiftDurationHours(s.start, s.end)
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.start} – {s.end} · {dur}h)
                    </option>
                  )
                })}
              </select>
            </label>

            {createLivePreview?.dailyHours !== undefined && (
              <div
                style={{
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                  color: '#475569',
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <span>
                  Tổng giờ ngày {formatIsoToShort(createTarget.workDate)}:{' '}
                  <strong>{createLivePreview.dailyHours}h</strong>
                </span>
                <span>
                  Tổng giờ trong tuần: <strong>{createLivePreview.weeklyHours}h</strong>
                </span>
              </div>
            )}

            <label>
              Ghi chú phân công (Tùy chọn)
              <input
                name="note"
                value={createTarget.note}
                onChange={(e) =>
                  setCreateTarget({ ...createTarget, note: e.target.value })
                }
                placeholder="Ví dụ: Trực quầy chính, hỗ trợ kiểm kho..."
                maxLength={120}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setCreateTarget(null)}
                disabled={isSaving}
              >
                Đóng
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={isSaving || (createLivePreview ? !createLivePreview.valid : false)}
              >
                {isSaving ? 'Đang lưu...' : 'Lưu phân công vào lịch'}
              </button>
            </div>
          </form>
        </dialog>
      )}

      {editTarget && (
        <dialog
          ref={editDialogRef}
          className="dashboard-modal"
          onCancel={() => setEditTarget(null)}
          onClick={(e) => e.target === e.currentTarget && setEditTarget(null)}
        >
          <div className="modal-heading">
            <h2>Chi tiết phân công ca làm việc</h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => setEditTarget(null)}
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>

          {(formValidationWarning || (editLivePreview && !editLivePreview.valid)) && (
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
              <strong>Không thể cập nhật:</strong>{' '}
              {formValidationWarning || editLivePreview?.errorMessage}
            </div>
          )}

          {editLivePreview?.valid && editLivePreview.warningMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                fontSize: 12.5,
                marginBottom: 12,
              }}
            >
              <strong>Lưu ý:</strong> {editLivePreview.warningMessage}
            </div>
          )}

          {(() => {
            const emp = employeeMap.get(editTarget.employeeId)
            const currentShift = shiftMap.get(editTarget.shiftId)

            return (
              <form className="shift-form" onSubmit={handleUpdateAssignmentSubmit}>
                <div
                  className="review-person"
                  style={{
                    marginBottom: 6,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <span className={`avatar ${emp?.tone || 'teal'}`}>
                    {emp?.initials || 'NV'}
                  </span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15 }}>
                      {emp?.name || `Nhân viên #${editTarget.employeeId}`}
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>
                      {emp?.code} · {emp?.department} · {emp?.role}
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <label>
                    Chuyển phân công cho nhân viên khác
                    <select
                      name="employeeId"
                      value={editTarget.employeeId}
                      onChange={(e) => {
                        setFormValidationWarning('')
                        setEditTarget({
                          ...editTarget,
                          employeeId: Number(e.target.value),
                        })
                      }}
                    >
                      {employees.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                          disabled={item.status !== 'Đang hoạt động'}
                        >
                          {item.code} – {item.name} ({item.department})
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="form-split">
                  <label>
                    Ngày làm việc
                    <input
                      type="date"
                      name="workDate"
                      value={editTarget.workDate}
                      onChange={(e) => {
                        setFormValidationWarning('')
                        setEditTarget({ ...editTarget, workDate: e.target.value })
                      }}
                      disabled={!isAdmin}
                      required
                    />
                  </label>

                  <label>
                    Trạng thái phân công
                    <select
                      name="status"
                      value={editTarget.status}
                      onChange={(e) => {
                        setFormValidationWarning('')
                        setEditTarget({
                          ...editTarget,
                          status: e.target.value as 'Đã phân công' | 'Dự kiến' | 'Đã hủy',
                        })
                      }}
                      disabled={!isAdmin}
                    >
                      <option value="Đã phân công">Đã phân công (Chính thức)</option>
                      <option value="Dự kiến">Dự kiến (Bản nháp)</option>
                      <option value="Đã hủy">Đã hủy</option>
                    </select>
                  </label>
                </div>

                <label>
                  Ca làm việc được gán
                  <select
                    name="shiftId"
                    value={editTarget.shiftId}
                    onChange={(e) => {
                      setFormValidationWarning('')
                      setEditTarget({
                        ...editTarget,
                        shiftId: Number(e.target.value),
                      })
                    }}
                    disabled={!isAdmin}
                    required
                  >
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.start} – {s.end})
                      </option>
                    ))}
                  </select>
                </label>

                {currentShift && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                      color: '#475569',
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <span>
                      Thời lượng ca:{' '}
                      <strong>
                        {computeShiftDurationHours(currentShift.start, currentShift.end)}h
                      </strong>
                    </span>
                    {editLivePreview?.weeklyHours !== undefined && (
                      <span>
                        Tổng giờ tuần của NV: <strong>{editLivePreview.weeklyHours}h</strong>
                      </span>
                    )}
                  </div>
                )}

                <label>
                  Ghi chú công việc
                  <input
                    name="note"
                    value={editTarget.note}
                    onChange={(e) =>
                      setEditTarget({ ...editTarget, note: e.target.value })
                    }
                    disabled={!isAdmin}
                    placeholder="Không có ghi chú"
                    maxLength={120}
                  />
                </label>

                {isAdmin ? (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8 }}>
                      {editTarget.status !== 'Đã hủy' && (
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={isSaving}
                          onClick={() => handleCancelAssignment(editTarget.id)}
                        >
                          Hủy ca này
                        </button>
                      )}
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={isSaving}
                        onClick={() => handleDeleteAssignment(editTarget.id)}
                        style={{ color: '#b91c1c', borderColor: '#fecaca' }}
                      >
                        Xóa vĩnh viễn
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="primary-button"
                      disabled={
                        isSaving ||
                        (editTarget.status !== 'Đã hủy' && editLivePreview
                          ? !editLivePreview.valid
                          : false)
                      }
                    >
                      {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setEditTarget(null)}
                    >
                      Đóng
                    </button>
                  </div>
                )}
              </form>
            )
          })()}
        </dialog>
      )}
    </div>
  )
}