'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { logout } from '@/actions/auth'
import { createClient } from '@/lib/supabase/client'
import WeeklyScheduleModule, {
  type ShiftAssignment,
  type ShiftAssignmentRow,
} from './WeeklyScheduleModule'
import AttendanceManagementModule from './AttendanceManagementModule'
import LeaveManagementModule from './LeaveManagementModule'

type IconName =
  | 'grid'
  | 'users'
  | 'building'
  | 'calendar'
  | 'check'
  | 'file'
  | 'chart'
  | 'settings'
  | 'logout'
  | 'chevron'
  | 'bell'
  | 'search'
  | 'plus'
  | 'arrow'
  | 'clock'
  | 'sun'
  | 'moon'
  | 'close'
  | 'menu'
  | 'help'
  | 'tick'
  | 'download'

const paths: Record<IconName, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      <circle cx="9" cy="7" r="4" />
    </>
  ),
  building: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1m-5 6v-3h4v3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18m-13 5h2m4 0h2" />
    </>
  ),
  check: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18m-13 5 3 3 5-5" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8m-8 4h5" />
    </>
  ),
  chart: <path d="M3 3v18h18M8 16v-5m5 5V7m5 9v-7" />,
  settings: (
    <>
      <path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  logout: (
    <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4m6-14 5 5-5 5m-7-5h12" />
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  bell: (
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 13h4" />
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M4 12h16m-5-5 5 5-5 5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
    </>
  ),
  moon: <path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1-1.5 3m0 3h.01" />
    </>
  ),
  tick: <path d="M20 6 9 17l-5-5" />,
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5M12 15V3" />
    </>
  ),
}

type ShiftRow = {
  id: number
  name: string
  start_time: string
  end_time: string
  count: number | null
  status: string | null
  icon: string | null
  created_at?: string
}

type Shift = {
  id: number
  name: string
  start: string
  end: string
  count: number
  status: string
  icon: IconName
  createdAt?: string
}

type EmployeeRow = {
  id: number
  code: string
  name: string
  initials: string
  email: string
  role: string
  department: string
  shift: string | null
  status: string | null
  tone: string | null
  created_at?: string
}

type Employee = {
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
  createdAt?: string
}

type DepartmentRow = {
  id: number
  name: string
  manager: string | null
  headcount: number | null
  attendance_rate: number | string | null
  active_shifts: string | null
  tone: string | null
  created_at?: string
}

type Department = {
  id: number
  name: string
  manager: string
  headcount: number
  attendanceRate: number
  activeShifts: string
  tone: string
  createdAt?: string
}

type AttendanceRow = {
  id: number
  employee_id: number | null
  shift_id: number | null
  name: string
  initials: string
  department: string
  shift: string
  work_date: string | null
  check_in: string | null
  check_out: string | null
  break_minutes: number | null
  total_minutes: number | null
  total_hours: string | null
  status: string | null
  tone: string | null
  created_at?: string
}

type AttendanceRecord = {
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

type LeaveRequestRow = {
  id: number
  employee_id: number | null
  name: string
  initials: string
  department: string
  type: string
  reason: string | null
  date_range: string
  days_count: string
  tone: string | null
  status: string | null
  start_date?: string | null
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  created_at?: string
  updated_at?: string
}

type LeaveRequest = {
  id: number
  employeeId: number | null
  name: string
  initials: string
  department: string
  type: string
  reason: string
  date: string
  days: string
  tone: string
  status: string
  start_date?: string | null
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  createdAt?: string
  updatedAt?: string
}

type WorkspaceSettingsRow = {
  id: number
  workspace_name: string
  timezone: string
  max_late_minutes: number
  notify_leave_email: boolean
  alert_late_threshold: boolean
  max_daily_hours?: number | null
  max_weekly_hours?: number | null
  min_rest_hours?: number | null
  block_on_overtime?: boolean | null
  block_on_rest_violation?: boolean | null
  updated_at?: string
}

type WorkspaceSettings = {
  workspaceName: string
  timezone: string
  maxLateMinutes: number
  notifyLeaveEmail: boolean
  alertLateThreshold: boolean
  maxDailyHours: number
  maxWeeklyHours: number
  minRestHours: number
  blockOnOvertime: boolean
  blockOnRestViolation: boolean
  updatedAt?: string
}

type ActivityItem = {
  id: string
  icon: IconName
  tone: 'teal' | 'orange' | 'blue'
  name: string
  text: string
  detail: string
  timestamp: string
}

type CalendarDaySlot = {
  isoDate: string
  dayLabel: string
  dateLabel: string
  isToday: boolean
}

function formatDateToIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateToHHMM(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function formatShortDate(isoDate: string): string {
  if (!isoDate) return '--/--'
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  return `${parts[2]}/${parts[1]}`
}

function getDayOfWeekLabel(date: Date): string {
  const day = date.getDay()
  return day === 0 ? 'CN' : `T${day + 1}`
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

function computeWorkedMinutes(
  checkIn: string,
  checkOut: string,
  breakMinutes = 0,
  allowOvernight = false,
): { valid: boolean; totalMinutes: number; error?: string } {
  const inMins = parseTimeToMinutes(checkIn)
  const outMins = parseTimeToMinutes(checkOut)

  if (inMins === null || outMins === null) {
    return { valid: false, totalMinutes: 0, error: 'Định dạng giờ không hợp lệ.' }
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
        'Giờ tan ca phải sau giờ vào ca (nếu là ca qua đêm, vui lòng bật tùy chọn Ca qua ngày).',
    }
  }

  if (breakMinutes < 0 || breakMinutes >= rawDiff) {
    return {
      valid: false,
      totalMinutes: 0,
      error: 'Thời gian nghỉ giữa giờ không được lớn hơn hoặc bằng tổng thời gian ca.',
    }
  }

  return {
    valid: true,
    totalMinutes: rawDiff - breakMinutes,
  }
}

function computeInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'NV'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[words.length - 2][0]}${words[words.length - 1][0]}`.toUpperCase()
}

function formatRelativeTime(isoTimestamp: string, nowMs: number): string {
  if (!isoTimestamp || !nowMs) return 'Gần đây'
  const time = Date.parse(isoTimestamp)
  if (Number.isNaN(time)) return 'Gần đây'
  const diffSeconds = Math.floor((nowMs - time) / 1000)
  if (diffSeconds < 60) return 'Vừa xong'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays <= 7) return `${diffDays} ngày trước`
  return isoTimestamp.slice(0, 10).split('-').reverse().join('/')
}

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function mapShiftRow(row: ShiftRow): Shift {
  const validIcons: IconName[] = ['sun', 'moon', 'clock']
  const iconName = validIcons.includes(row.icon as IconName)
    ? (row.icon as IconName)
    : 'clock'
  return {
    id: row.id,
    name: row.name,
    start: row.start_time || '08:00',
    end: row.end_time || '12:00',
    count: Number(row.count ?? 0),
    status: row.status || 'Sắp bắt đầu',
    icon: iconName,
    createdAt: row.created_at,
  }
}

function mapEmployeeRow(row: EmployeeRow): Employee {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    initials: row.initials || computeInitials(row.name),
    email: row.email,
    role: row.role,
    department: row.department,
    shift: row.shift || 'Ca sáng',
    status: row.status || 'Đang hoạt động',
    tone: row.tone || 'teal',
    createdAt: row.created_at,
  }
}

function mapDepartmentRow(row: DepartmentRow): Department {
  const parsedRate = Number(row.attendance_rate ?? 0)
  return {
    id: row.id,
    name: row.name,
    manager: row.manager || 'Chưa bổ nhiệm',
    headcount: Number(row.headcount ?? 0),
    attendanceRate: Number.isFinite(parsedRate) ? parsedRate : 0,
    activeShifts: row.active_shifts || 'Chưa phân ca',
    tone: row.tone || 'teal',
    createdAt: row.created_at,
  }
}

function mapAttendanceRow(
  row: AttendanceRow,
  fallbackTodayIso: string,
): AttendanceRecord {
  const fallbackDate = row.created_at
    ? row.created_at.slice(0, 10)
    : fallbackTodayIso
  const rawCheckOut =
    row.check_out && row.check_out !== '--:--' ? row.check_out : null
  const breakMins = Number(row.break_minutes ?? 0)

  let totalMins = Number(row.total_minutes ?? 0)
  if (totalMins === 0 && row.check_in && rawCheckOut) {
    const computed = computeWorkedMinutes(
      row.check_in,
      rawCheckOut,
      breakMins,
      true,
    )
    if (computed.valid) {
      totalMins = computed.totalMinutes
    }
  }

  const totalHoursText =
    row.status === 'Vắng mặt'
      ? '0h 00m'
      : rawCheckOut
        ? totalMins > 0
          ? formatMinutesToHoursText(totalMins)
          : row.total_hours || '0h 00m'
        : 'Đang trong ca'

  return {
    id: row.id,
    employeeId: row.employee_id,
    shiftId: row.shift_id,
    name: row.name,
    initials: row.initials || computeInitials(row.name),
    department: row.department,
    shift: row.shift,
    workDate: row.work_date || fallbackDate,
    checkIn: row.check_in || '--:--',
    checkOut: rawCheckOut,
    breakMinutes: breakMins,
    totalMinutes: totalMins,
    totalHours: totalHoursText,
    status: row.status || 'Đúng giờ',
    tone: row.tone || 'teal',
    createdAt: row.created_at,
  }
}

function mapLeaveRequestRow(row: LeaveRequestRow): LeaveRequest {
  return {
    id: row.id,
    employeeId: row.employee_id,
    name: row.name,
    initials: row.initials || computeInitials(row.name),
    department: row.department,
    type: row.type,
    reason: row.reason || 'Không có ghi chú',
    date: row.date_range,
    days: row.days_count,
    tone: row.tone || 'teal',
    status: row.status || 'Chờ duyệt',
    start_date: row.start_date,
    end_date: row.end_date,
    start_time: row.start_time,
    end_time: row.end_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapShiftAssignmentRow(row: ShiftAssignmentRow): ShiftAssignment {
  const validStatus =
    row.status === 'Dự kiến' || row.status === 'Đã hủy'
      ? row.status
      : 'Đã phân công'
  return {
    id: row.id,
    employeeId: Number(row.employee_id),
    shiftId: Number(row.shift_id),
    workDate: row.work_date,
    status: validStatus,
    note: row.note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapSettingsRow(row: WorkspaceSettingsRow): WorkspaceSettings {
  return {
    workspaceName: row.workspace_name || 'ShiftFlow Enterprise Workspace',
    timezone: row.timezone || 'Asia/Ho_Chi_Minh (GMT+7)',
    maxLateMinutes: Number(row.max_late_minutes ?? 10),
    notifyLeaveEmail: Boolean(row.notify_leave_email),
    alertLateThreshold: Boolean(row.alert_late_threshold),
    maxDailyHours: Number(row.max_daily_hours ?? 12),
    maxWeeklyHours: Number(row.max_weekly_hours ?? 48),
    minRestHours: Number(row.min_rest_hours ?? 11),
    blockOnOvertime: Boolean(row.block_on_overtime),
    blockOnRestViolation: Boolean(row.block_on_rest_violation),
    updatedAt: row.updated_at,
  }
}

function ShiftFlowMark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="9" fill="currentColor" />
      <rect
        x="8"
        y="9"
        width="20"
        height="18"
        rx="3.5"
        stroke="#0b1730"
        strokeWidth="2.2"
      />
      <path
        d="M13 6.5v4M23 6.5v4"
        stroke="#0b1730"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M12 20c2-2.6 4-2.6 6 0s4 2.6 6 0"
        stroke="#0b1730"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="23.5" cy="14.5" r="1.4" fill="#0b1730" />
    </svg>
  )
}

function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

const navigation: { label: string; icon: IconName }[] = [
  { label: 'Tổng quan', icon: 'grid' },
  { label: 'Nhân viên', icon: 'users' },
  { label: 'Phòng ban', icon: 'building' },
  { label: 'Lịch làm việc', icon: 'calendar' },
  { label: 'Chấm công', icon: 'check' },
  { label: 'Đơn nghỉ phép', icon: 'file' },
  { label: 'Báo cáo', icon: 'chart' },
]

function Avatar({
  initials = 'AD',
  tone = '',
}: {
  initials?: string
  tone?: string
}) {
  return <span className={`avatar ${tone}`}>{initials}</span>
}

function PanelHeading({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="dashboard-modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Đóng">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  )
}

function ActivityFeedList({
  items,
  nowMs,
}: {
  items: ActivityItem[]
  nowMs: number
}) {
  if (items.length === 0) {
    return (
      <div className="table-note" style={{ marginTop: 12 }}>
        <Icon name="clock" />
        Chưa có hoạt động nào được ghi nhận trong hệ thống.
      </div>
    )
  }

  return (
    <div className="activity-feed">
      {items.map((a) => (
        <div className="activity-item" key={a.id}>
          <span className={`activity-icon ${a.tone}`}>
            <Icon name={a.icon} />
          </span>
          <div>
            <p>
              <strong>{a.name}</strong> {a.text}
            </p>
            <span>{a.detail}</span>
            <small>{formatRelativeTime(a.timestamp, nowMs)}</small>
          </div>
        </div>
      ))}
    </div>
  )
}

const periodOptions = [
  { value: 'week', label: '7 ngày gần nhất' },
  { value: 'previous', label: '7 ngày trước' },
]

export default function DashboardPage() {
  const [drawer, setDrawer] = useState(false)
  const [active, setActive] = useState('Tổng quan')
  const [modal, setModal] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [shifts, setShifts] = useState<Shift[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([])

  const [settings, setSettings] = useState<WorkspaceSettings>({
    workspaceName: 'ShiftFlow Enterprise Workspace',
    timezone: 'Asia/Ho_Chi_Minh (GMT+7)',
    maxLateMinutes: 10,
    notifyLeaveEmail: true,
    alertLateThreshold: true,
    maxDailyHours: 12,
    maxWeeklyHours: 48,
    minRestHours: 11,
    blockOnOvertime: false,
    blockOnRestViolation: false,
  })

  const [todayIso, setTodayIso] = useState<string>('')
  const [nowMs, setNowMs] = useState<number>(0)
  const [defaultTimeHHMM, setDefaultTimeHHMM] = useState<string>('08:00')
  const [currentDateString, setCurrentDateString] = useState<string>('')
  const [recent7Days, setRecent7Days] = useState<CalendarDaySlot[]>([])
  const [previous7Days, setPrevious7Days] = useState<CalendarDaySlot[]>([])

  const [review, setReview] = useState<number | null>(null)
  const [checkoutTarget, setCheckoutTarget] = useState<AttendanceRecord | null>(null)
  const [selectedCheckInEmpId, setSelectedCheckInEmpId] = useState<string>('')
  const [selectedCheckInShift, setSelectedCheckInShift] = useState<string>('Ca sáng')
  const [period, setPeriod] = useState('week')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [empSearch, setEmpSearch] = useState('')
  const [empDeptFilter, setEmpDeptFilter] = useState('Tất cả')
  const [attFilter, setAttFilter] = useState('Tất cả')
  const [attDateFilter, setAttDateFilter] = useState<string>('')
  const [leaveFilter, setLeaveFilter] = useState('Tất cả')

  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('Nguyễn Minh Trí')
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'employee'>('admin')

  const dropdownRef = useRef<HTMLDivElement>(null)
  const isAdmin = userRole === 'admin' || userRole === 'manager'

  const fetchSupabaseData = useCallback(
    async (showSpinner = false, fallbackIso = '') => {
      if (showSpinner) setIsLoading(true)
      setFetchError(null)

      try {
        const supabase = createClient()

        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser()

        if (authErr) {
          setFetchError('Không thể xác thực phiên đăng nhập. Vui lòng đăng nhập lại.')
          setIsLoading(false)
          return
        }

        if (user) {
          const email = user.email || ''
          setUserEmail(email)

          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, role')
            .eq('id', user.id)
            .maybeSingle()

          if (profileData) {
            if (profileData.full_name && profileData.full_name !== 'New User') {
              setUserName(profileData.full_name)
            }
            const rawRole = String(profileData.role || '').toLowerCase()
            if (
              rawRole === 'admin' ||
              rawRole === 'manager' ||
              ['admin@shiftflow.com', 'minhtri@shiftflow.com'].includes(email.toLowerCase())
            ) {
              setUserRole(rawRole === 'manager' ? 'manager' : 'admin')
            } else {
              setUserRole('employee')
            }
          }
        }

        const [
          empRes,
          deptRes,
          shiftRes,
          attRes,
          leaveRes,
          assignRes,
          settingsRes,
        ] = await Promise.all([
          supabase.from('employees').select('*').order('id', { ascending: true }),
          supabase.from('departments').select('*').order('id', { ascending: true }),
          supabase.from('shifts').select('*').order('id', { ascending: true }),
          supabase.from('attendance_records').select('*').order('work_date', { ascending: false }).order('id', { ascending: false }),
          supabase.from('leave_requests').select('*').order('id', { ascending: false }),
          supabase.from('shift_assignments').select('*').order('work_date', { ascending: true }).order('id', { ascending: true }),
          supabase.from('workspace_settings').select('*').eq('id', 1).maybeSingle(),
        ])

        const errors: string[] = []
        if (empRes.error) errors.push(`Nhân viên (${empRes.error.message})`)
        if (deptRes.error) errors.push(`Phòng ban (${deptRes.error.message})`)
        if (shiftRes.error) errors.push(`Ca làm (${shiftRes.error.message})`)
        if (attRes.error) errors.push(`Chấm công (${attRes.error.message})`)
        if (leaveRes.error) errors.push(`Nghỉ phép (${leaveRes.error.message})`)
        if (assignRes.error) errors.push(`Phân công ca (${assignRes.error.message})`)

        if (errors.length > 0) {
          setFetchError(`Không thể tải một số dữ liệu: ${errors.join(', ')}. Hãy kiểm tra lại migration trên Supabase.`)
        }

        if (empRes.data) setEmployees((empRes.data as EmployeeRow[]).map(mapEmployeeRow))
        if (deptRes.data) setDepartments((deptRes.data as DepartmentRow[]).map(mapDepartmentRow))
        if (shiftRes.data) setShifts((shiftRes.data as ShiftRow[]).map(mapShiftRow))
        if (attRes.data) {
          setAttendanceLogs(
            (attRes.data as AttendanceRow[]).map((row) => mapAttendanceRow(row, fallbackIso)),
          )
        }
        if (leaveRes.data) setRequests((leaveRes.data as LeaveRequestRow[]).map(mapLeaveRequestRow))
        if (assignRes.data) {
          setShiftAssignments((assignRes.data as ShiftAssignmentRow[]).map(mapShiftAssignmentRow))
        }
        if (settingsRes.data && !settingsRes.error) {
          setSettings(mapSettingsRow(settingsRes.data as WorkspaceSettingsRow))
        }
      } catch {
        setFetchError('Đã xảy ra lỗi kết nối mạng khi truy vấn dữ liệu từ Supabase.')
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    const now = new Date()
    const currentIso = formatDateToIso(now)
    setTodayIso(currentIso)
    setNowMs(now.getTime())
    setDefaultTimeHHMM(formatDateToHHMM(now))

    const formattedDate = new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now)
    setCurrentDateString(formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1))

    const buildDays = (startOffset: number): CalendarDaySlot[] => {
      const list: CalendarDaySlot[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(now)
        d.setDate(now.getDate() - (startOffset - i))
        const iso = formatDateToIso(d)
        list.push({
          isoDate: iso,
          dayLabel: getDayOfWeekLabel(d),
          dateLabel: formatShortDate(iso),
          isToday: iso === currentIso,
        })
      }
      return list
    }

    setRecent7Days(buildDays(6))
    setPrevious7Days(buildDays(13))

    fetchSupabaseData(true, currentIso)

    const supabase = createClient()
    const channel = supabase
      .channel('shiftflow-main-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => fetchSupabaseData(false, currentIso))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, () => fetchSupabaseData(false, currentIso))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => fetchSupabaseData(false, currentIso))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => fetchSupabaseData(false, currentIso))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => fetchSupabaseData(false, currentIso))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_assignments' }, () => fetchSupabaseData(false, currentIso))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_settings' }, () => fetchSupabaseData(false, currentIso))
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchSupabaseData])

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(''), 4500)
    return () => clearTimeout(id)
  }, [notice])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function navigate(label: string) {
    setActive(label)
    setDrawer(false)
  }

  function openCheckInModal() {
    const now = new Date()
    setDefaultTimeHHMM(formatDateToHHMM(now))
    if (!todayIso) setTodayIso(formatDateToIso(now))
    if (employees.length > 0 && !selectedCheckInEmpId) {
      setSelectedCheckInEmpId(String(employees[0].id))
      setSelectedCheckInShift(employees[0].shift || 'Ca sáng')
    }
    setModal('manual-checkin')
  }

  function openCheckOutModal(log: AttendanceRecord) {
    setDefaultTimeHHMM(formatDateToHHMM(new Date()))
    setCheckoutTarget(log)
  }

  async function createShift(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isAdmin) {
      setNotice('Bạn không có quyền quản trị để tạo mẫu ca làm mới.')
      return
    }

    const data = new FormData(e.currentTarget)
    const name = String(data.get('name') || '').trim()
    const start = String(data.get('start') || '').trim()
    const end = String(data.get('end') || '').trim()
    const count = Number(data.get('count') || 0)

    if (!name) {
      setNotice('Vui lòng nhập tên mẫu ca làm việc.')
      return
    }
    if (start === end) {
      setNotice('Giờ kết thúc không được trùng với giờ bắt đầu.')
      return
    }
    if (!Number.isFinite(count) || count < 1) {
      setNotice('Số lượng nhân viên định biên phải lớn hơn 0.')
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('shifts').insert([
      { name, start_time: start, end_time: end, count, status: 'Sắp bắt đầu', icon: 'clock' },
    ])
    setIsSubmitting(false)

    if (error) {
      setNotice('Không thể lưu mẫu ca làm việc. Vui lòng kiểm tra quyền hạn hoặc kết nối.')
      return
    }

    setModal(null)
    setNotice(`Đã lưu mẫu ca làm việc "${name}" vào cơ sở dữ liệu.`)
    await fetchSupabaseData(false, todayIso)
  }

  async function handleAddEmployee(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isAdmin) {
      setNotice('Chỉ Quản trị viên mới có quyền thêm hồ sơ nhân sự.')
      return
    }

    const data = new FormData(e.currentTarget)
    const name = String(data.get('name') || '').trim()
    const email = String(data.get('email') || '').trim().toLowerCase()
    const role = String(data.get('role') || '').trim()
    const department = String(data.get('department') || '').trim()
    const shift = String(data.get('shift') || 'Ca sáng').trim()

    if (!name || !email || !role || !department) {
      setNotice('Vui lòng điền đầy đủ thông tin nhân viên.')
      return
    }

    const initials = computeInitials(name)
    const maxCodeNum = employees.reduce((max, emp) => {
      const match = emp.code.match(/(\d+)$/)
      return match ? Math.max(max, Number(match[1])) : max
    }, employees.length)
    const code = `SF-${String(maxCodeNum + 1).padStart(3, '0')}`
    const tone = ['peach', 'lavender', 'mint'][employees.length % 3]

    setIsSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('employees').insert([
      { code, name, initials, email, role, department, shift, status: 'Đang hoạt động', tone },
    ])
    setIsSubmitting(false)

    if (error) {
      setNotice(error.code === '23505' ? 'Email hoặc mã nhân viên đã tồn tại.' : 'Không thể thêm nhân viên.')
      return
    }

    setModal(null)
    setNotice(`Đã thêm nhân viên ${name} (${code}) thành công.`)
    await fetchSupabaseData(false, todayIso)
  }

  async function handleAddDepartment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isAdmin) {
      setNotice('Chỉ Quản trị viên mới có quyền thêm phòng ban.')
      return
    }

    const data = new FormData(e.currentTarget)
    const name = String(data.get('name') || '').trim()
    const manager = String(data.get('manager') || '').trim()
    const headcount = Number(data.get('headcount') || 0)
    const activeShifts = String(data.get('activeShifts') || 'Ca sáng, Ca chiều').trim()

    if (!name || !manager || headcount < 0) {
      setNotice('Vui lòng kiểm tra lại thông tin phòng ban.')
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('departments').insert([
      { name, manager, headcount, attendance_rate: 0, active_shifts: activeShifts, tone: 'teal' },
    ])
    setIsSubmitting(false)

    if (error) {
      setNotice('Không thể tạo phòng ban mới. Vui lòng thử lại.')
      return
    }

    setModal(null)
    setNotice(`Đã tạo ${name} thành công.`)
    await fetchSupabaseData(false, todayIso)
  }

  async function handleManualCheckIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const now = new Date()
    const fallbackDate = todayIso || formatDateToIso(now)

    const data = new FormData(e.currentTarget)
    const empId = Number(data.get('employeeId'))
    const shiftName = String(data.get('shift') || '').trim()
    const workDate = String(data.get('workDate') || fallbackDate).trim()
    const checkIn = String(data.get('checkIn') || '').trim()
    const checkOutRaw = String(data.get('checkOut') || '').trim()
    const breakMinutes = Number(data.get('breakMinutes') || 0)
    const isAbsent = data.get('isAbsent') === 'on'
    const isOvernight = data.get('isOvernight') === 'on'

    const selectedEmp = employees.find((emp) => emp.id === empId)
    if (!selectedEmp) {
      setNotice('Vui lòng chọn một nhân viên hợp lệ.')
      return
    }

    const matchedShift = shifts.find((s) => s.name === shiftName)

    if (!isAbsent) {
      const openRecord = attendanceLogs.find(
        (log) =>
          (log.employeeId === selectedEmp.id || log.name.toLowerCase() === selectedEmp.name.toLowerCase()) &&
          log.checkOut === null &&
          log.status !== 'Vắng mặt',
      )

      if (openRecord) {
        setNotice(
          `Nhân viên ${selectedEmp.name} đang có ca làm ngày ${formatShortDate(openRecord.workDate)} (vào lúc ${openRecord.checkIn}) chưa tan ca. Vui lòng bấm "Tan ca" trước.`,
        )
        return
      }
    }

    let finalStatus = 'Đúng giờ'
    let finalCheckIn = checkIn
    let finalCheckOut: string | null = checkOutRaw ? checkOutRaw : null
    let totalMinutes = 0
    let totalHoursText = 'Đang trong ca'

    if (isAbsent) {
      finalStatus = 'Vắng mặt'
      finalCheckIn = '--:--'
      finalCheckOut = null
      totalMinutes = 0
      totalHoursText = '0h 00m'
    } else {
      const inMins = parseTimeToMinutes(checkIn)
      if (inMins === null) {
        setNotice('Vui lòng nhập giờ vào ca hợp lệ.')
        return
      }

      if (matchedShift) {
        const shiftStartMins = parseTimeToMinutes(matchedShift.start)
        if (shiftStartMins !== null && inMins > shiftStartMins + settings.maxLateMinutes) {
          finalStatus = 'Đi trễ'
        }
      }

      if (finalCheckOut) {
        const calc = computeWorkedMinutes(finalCheckIn, finalCheckOut, breakMinutes, isOvernight)
        if (!calc.valid) {
          setNotice(calc.error || 'Giờ tan ca không hợp lệ.')
          return
        }
        totalMinutes = calc.totalMinutes
        totalHoursText = formatMinutesToHoursText(totalMinutes)
      }
    }

    setIsSubmitting(true)
    const supabase = createClient()
    const nowIsoStr = now.toISOString()
    const { error } = await supabase.from('attendance_records').insert([
      {
        employee_id: selectedEmp.id,
        shift_id: matchedShift?.id ?? null,
        name: selectedEmp.name,
        initials: selectedEmp.initials,
        department: selectedEmp.department,
        shift: shiftName || selectedEmp.shift,
        work_date: workDate,
        check_in: finalCheckIn,
        check_out: finalCheckOut,
        check_in_at: isAbsent ? null : nowIsoStr,
        check_out_at: finalCheckOut ? nowIsoStr : null,
        break_minutes: isAbsent ? 0 : Math.max(0, breakMinutes),
        total_minutes: totalMinutes,
        total_hours: totalHoursText,
        status: finalStatus,
        tone: selectedEmp.tone || 'teal',
      },
    ])
    setIsSubmitting(false)

    if (error) {
      setNotice(error.code === '23505' ? 'Nhân viên này đang có ca làm chưa chốt.' : 'Không thể lưu bản ghi chấm công.')
      return
    }

    setModal(null)
    setNotice(
      isAbsent
        ? `Đã ghi nhận vắng mặt cho ${selectedEmp.name}.`
        : finalCheckOut
          ? `Đã lưu chấm công (${totalHoursText}) cho ${selectedEmp.name}.`
          : `Đã ghi nhận vào ca lúc ${finalCheckIn} cho ${selectedEmp.name}.`,
    )
    await fetchSupabaseData(false, fallbackDate)
  }

  async function handleCheckOutSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!checkoutTarget) return

    const data = new FormData(e.currentTarget)
    const checkOutTime = String(data.get('checkOut') || '').trim()
    const breakMinutes = Number(data.get('breakMinutes') || 0)
    const isOvernight = data.get('isOvernight') === 'on'

    const calc = computeWorkedMinutes(
      checkoutTarget.checkIn,
      checkOutTime,
      breakMinutes,
      isOvernight,
    )

    if (!calc.valid) {
      setNotice(calc.error || 'Dữ liệu giờ tan ca không hợp lệ.')
      return
    }

    const totalHoursText = formatMinutesToHoursText(calc.totalMinutes)

    setIsSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('attendance_records')
      .update({
        check_out: checkOutTime,
        check_out_at: new Date().toISOString(),
        break_minutes: Math.max(0, breakMinutes),
        total_minutes: calc.totalMinutes,
        total_hours: totalHoursText,
      })
      .eq('id', checkoutTarget.id)
    setIsSubmitting(false)

    if (error) {
      setNotice('Không thể cập nhật giờ tan ca lên cơ sở dữ liệu.')
      return
    }

    const targetName = checkoutTarget.name
    setCheckoutTarget(null)
    setNotice(`Đã ghi nhận tan ca lúc ${checkOutTime} cho ${targetName} (Tổng: ${totalHoursText}).`)
    await fetchSupabaseData(false, todayIso)
  }

async function handleCreateLeaveRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const empId = Number(data.get('employeeId'))
    const type = String(data.get('type') || 'Nghỉ phép năm').trim()
    const startDate = String(data.get('startDate') || '').trim()
    const endDate = String(data.get('endDate') || '').trim() || startDate
    const rawDateRange = String(data.get('dateRange') || '').trim()
    const daysCount = String(data.get('daysCount') || '1 ngày').trim()
    const reason = String(data.get('reason') || '').trim()

    const formatVN = (iso: string) => {
      const parts = iso.split('-')
      return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso
    }

    const finalDateRange = rawDateRange
      ? rawDateRange
      : startDate
        ? startDate === endDate
          ? formatVN(startDate)
          : `${formatVN(startDate)} – ${formatVN(endDate)}`
        : ''

    const emp = employees.find((item) => item.id === empId)
    if (!emp || !finalDateRange || !reason) {
      setNotice('Vui lòng điền đầy đủ thời gian nghỉ và lý do xin nghỉ phép.')
      return
    }

    if (startDate && endDate && endDate < startDate) {
      setNotice('Ngày kết thúc nghỉ phép không được trước ngày bắt đầu.')
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('leave_requests').insert([
      {
        employee_id: emp.id,
        name: emp.name,
        initials: emp.initials,
        department: emp.department,
        type,
        reason,
        date_range: finalDateRange,
        days_count: daysCount,
        tone: emp.tone || 'teal',
        status: 'Chờ duyệt',
      },
    ])
    setIsSubmitting(false)

    if (error) {
      setNotice(`Không thể gửi đơn nghỉ phép: ${error.message}`)
      return
    }

    setModal(null)
    setNotice(`Đã tạo đơn nghỉ phép cho ${emp.name} thành công.`)
    await fetchSupabaseData(false, todayIso)
  }

  async function updateRequestStatus(id: number, status: string) {
    if (!isAdmin) {
      setNotice('Chỉ Quản trị viên mới có quyền phê duyệt hoặc từ chối đơn.')
      return
    }

    const targetLeave = requests.find((r) => r.id === id)
    if (status === 'Đã duyệt' && targetLeave && (!targetLeave.start_date || !targetLeave.end_date)) {
      setNotice('Không thể duyệt đơn: Đơn nghỉ phép này thiếu ngày bắt đầu hoặc kết thúc chuẩn. Vui lòng cập nhật đơn.')
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('leave_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    setIsSubmitting(false)

    if (error) {
      setNotice(`Thao tác thất bại: ${error.message}`)
      return
    }

    setReview(null)
    setNotice(`Đã cập nhật trạng thái đơn nghỉ phép: ${status}.`)
    await fetchSupabaseData(false, todayIso)
  }
  async function handleSaveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isAdmin) {
      setNotice('Chỉ Quản trị viên mới có quyền thay đổi cấu hình hệ thống.')
      return
    }

    const trimmedName = settings.workspaceName.trim()
    const trimmedTz = settings.timezone.trim()
    const lateMins = Number(settings.maxLateMinutes)

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      setNotice('Tên không gian làm việc phải từ 2 đến 100 ký tự.')
      return
    }
    if (!trimmedTz) {
      setNotice('Vui lòng nhập múi giờ hệ thống hợp lệ.')
      return
    }
    if (!Number.isFinite(lateMins) || lateMins < 0 || lateMins > 240) {
      setNotice('Số phút cho phép trễ phải nằm trong khoảng từ 0 đến 240 phút.')
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('workspace_settings').upsert(
      {
        id: 1,
        workspace_name: trimmedName,
        timezone: trimmedTz,
        max_late_minutes: Math.round(lateMins),
        notify_leave_email: settings.notifyLeaveEmail,
        alert_late_threshold: settings.alertLateThreshold,
        max_daily_hours: settings.maxDailyHours,
        max_weekly_hours: settings.maxWeeklyHours,
        min_rest_hours: settings.minRestHours,
        block_on_overtime: settings.blockOnOvertime,
        block_on_rest_violation: settings.blockOnRestViolation,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    setIsSubmitting(false)

    if (error) {
      setNotice('Không thể lưu cấu hình vào cơ sở dữ liệu.')
      return
    }

    setNotice('Đã lưu cấu hình hệ thống ShiftFlow vào cơ sở dữ liệu thành công.')
    await fetchSupabaseData(false, todayIso)
  }

  async function handleToggleSetting(field: 'notifyLeaveEmail' | 'alertLateThreshold') {
    if (!isAdmin) {
      setNotice('Chỉ Quản trị viên mới có quyền thay đổi tùy chọn tự động hóa.')
      return
    }

    const nextValue = !settings[field]
    const updatedSettings = { ...settings, [field]: nextValue }
    setSettings(updatedSettings)

    const supabase = createClient()
    const { error } = await supabase.from('workspace_settings').upsert(
      {
        id: 1,
        workspace_name: updatedSettings.workspaceName.trim(),
        timezone: updatedSettings.timezone.trim(),
        max_late_minutes: Math.round(Number(updatedSettings.maxLateMinutes)),
        notify_leave_email: updatedSettings.notifyLeaveEmail,
        alert_late_threshold: updatedSettings.alertLateThreshold,
        max_daily_hours: updatedSettings.maxDailyHours,
        max_weekly_hours: updatedSettings.maxWeeklyHours,
        min_rest_hours: updatedSettings.minRestHours,
        block_on_overtime: updatedSettings.blockOnOvertime,
        block_on_rest_violation: updatedSettings.blockOnRestViolation,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

    if (error) {
      setSettings(settings)
      setNotice('Không thể lưu tùy chọn thông báo lên cơ sở dữ liệu.')
      return
    }

    setNotice('Đã đồng bộ tùy chọn thông báo lên cơ sở dữ liệu.')
  }

  const currentMonthPrefix = todayIso ? todayIso.slice(0, 7) : ''

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'Chờ duyệt').length,
    [requests],
  )

  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === review),
    [requests, review],
  )

  const todayAttendanceStats = useMemo(() => {
    const todayRecords = todayIso
      ? attendanceLogs.filter((log) => log.workDate === todayIso)
      : []
    const checkedInRecords = todayRecords.filter((log) => log.status !== 'Vắng mặt')
    const onTimeCount = todayRecords.filter((log) => log.status === 'Đúng giờ').length
    const lateCount = todayRecords.filter((log) => log.status === 'Đi trễ').length
    const absentCount = todayRecords.filter((log) => log.status === 'Vắng mặt').length
    const openShiftsCount = checkedInRecords.filter((log) => log.checkOut === null).length
    const completedShiftsCount = checkedInRecords.filter((log) => log.checkOut !== null).length

    const attendanceRatePercent =
      employees.length > 0
        ? ((checkedInRecords.length / employees.length) * 100).toFixed(1).replace('.', ',')
        : '0'

    return {
      totalToday: todayRecords.length,
      checkedInCount: checkedInRecords.length,
      onTimeCount,
      lateCount,
      absentCount,
      openShiftsCount,
      completedShiftsCount,
      attendanceRatePercent,
    }
  }, [attendanceLogs, employees.length, todayIso])

  const activeEmployeesCount = useMemo(
    () => employees.filter((e) => e.status === 'Đang hoạt động').length,
    [employees],
  )

  const newEmployeesThisMonth = useMemo(
    () =>
      currentMonthPrefix
        ? employees.filter((e) => e.createdAt && e.createdAt.startsWith(currentMonthPrefix)).length
        : 0,
    [employees, currentMonthPrefix],
  )

  const metrics = useMemo(
    () => [
      {
        label: 'Tổng nhân sự',
        value: String(employees.length),
        description: `${activeEmployeesCount} nhân sự đang hoạt động`,
        icon: 'users' as IconName,
        tone: 'teal',
        trend: newEmployeesThisMonth > 0 ? `+${newEmployeesThisMonth} mới trong tháng` : 'Dữ liệu từ Supabase',
      },
      {
        label: 'Đã chấm công hôm nay',
        value: String(todayAttendanceStats.checkedInCount),
        description: employees.length > 0 ? `${todayAttendanceStats.attendanceRatePercent}% tổng nhân sự` : 'Chưa có hồ sơ nhân sự',
        icon: 'check' as IconName,
        tone: 'blue',
        trend:
          todayAttendanceStats.checkedInCount > 0
            ? `${todayAttendanceStats.openShiftsCount} đang trong ca · ${todayAttendanceStats.completedShiftsCount} đã tan ca`
            : 'Chưa có lượt chấm công hôm nay',
      },
      {
        label: 'Đi trễ / Vắng mặt',
        value: String(todayAttendanceStats.lateCount + todayAttendanceStats.absentCount),
        description: todayIso ? `Ghi nhận ngày ${formatShortDate(todayIso)}` : 'Ghi nhận hôm nay',
        icon: 'clock' as IconName,
        tone: 'orange',
        trend: `${todayAttendanceStats.lateCount} đi trễ · ${todayAttendanceStats.absentCount} vắng mặt`,
      },
      {
        label: 'Đơn chờ duyệt',
        value: String(pendingCount),
        description: pendingCount > 0 ? 'Đang chờ xử lý' : 'Đã xử lý toàn bộ đơn',
        icon: 'file' as IconName,
        tone: 'purple',
        trend: `${pendingCount} đơn cần xem xét`,
      },
    ],
    [employees.length, activeEmployeesCount, newEmployeesThisMonth, todayAttendanceStats, todayIso, pendingCount],
  )

  const chartData = useMemo(() => {
    const activeSlots = period === 'week' ? recent7Days : previous7Days
    const days = activeSlots.map((slot) => {
      const dayLogs = attendanceLogs.filter((log) => log.workDate === slot.isoDate)
      return {
        isoDate: slot.isoDate,
        day: slot.dayLabel,
        dateLabel: slot.dateLabel,
        onTime: dayLogs.filter((l) => l.status === 'Đúng giờ').length,
        late: dayLogs.filter((l) => l.status === 'Đi trễ').length,
        absent: dayLogs.filter((l) => l.status === 'Vắng mặt').length,
        isToday: slot.isToday,
      }
    })

    const maxDayTotal = days.reduce((max, item) => Math.max(max, item.onTime + item.late + item.absent), 0)
    const rawMax = Math.max(employees.length, maxDayTotal, 4)
    const yAxisMax = Math.ceil(rawMax / 4) * 4

    const totalOnTime = days.reduce((acc, item) => acc + item.onTime, 0)
    const totalAll = days.reduce((acc, item) => acc + item.onTime + item.late + item.absent, 0)
    const avgOnTimeRate = totalAll > 0 ? `${((totalOnTime / totalAll) * 100).toFixed(1).replace('.', ',')}%` : '0%'

    return {
      days,
      yAxisMax,
      yTicks: [yAxisMax, Math.round(yAxisMax * 0.75), Math.round(yAxisMax * 0.5), Math.round(yAxisMax * 0.25), 0],
      avgOnTimeRate,
      totalRecordsInPeriod: totalAll,
    }
  }, [attendanceLogs, employees.length, period, recent7Days, previous7Days])

  const realActivities = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = []

    for (const log of attendanceLogs.slice(0, 8)) {
      const actionText =
        log.status === 'Vắng mặt'
          ? 'được ghi nhận vắng mặt.'
          : log.checkOut
            ? `đã hoàn tất ca làm (${log.totalHours}).`
            : 'vừa chấm công vào ca.'
      items.push({
        id: `att-${log.id}`,
        icon: 'check',
        tone: log.status === 'Đi trễ' ? 'orange' : 'teal',
        name: log.name,
        text: actionText,
        detail: `${log.shift} · Ngày ${formatShortDate(log.workDate)} (${log.checkIn}${log.checkOut ? ` – ${log.checkOut}` : ''})`,
        timestamp: log.createdAt || `${log.workDate}T08:00:00`,
      })
    }

    for (const assign of shiftAssignments.slice(-6)) {
      const emp = employees.find((e) => e.id === assign.employeeId)
      const shift = shifts.find((s) => s.id === assign.shiftId)
      if (emp && shift) {
        items.push({
          id: `assign-${assign.id}`,
          icon: 'calendar',
          tone: assign.status === 'Đã hủy' ? 'orange' : 'blue',
          name: emp.name,
          text: assign.status === 'Đã hủy' ? `đã bị hủy phân công ${shift.name}.` : `được phân công ${shift.name}.`,
          detail: `Ngày ${formatShortDate(assign.workDate)} · ${assign.status}`,
          timestamp: assign.updatedAt || assign.createdAt || '',
        })
      }
    }

    for (const req of requests.slice(0, 6)) {
      const reqText =
        req.status === 'Đã duyệt'
          ? 'đã được duyệt đơn nghỉ phép.'
          : req.status === 'Từ chối'
            ? 'bị từ chối đơn nghỉ phép.'
            : 'gửi yêu cầu nghỉ phép mới.'
      items.push({
        id: `leave-${req.id}`,
        icon: 'file',
        tone: req.status === 'Chờ duyệt' ? 'orange' : 'blue',
        name: req.name,
        text: reqText,
        detail: `${req.type} · ${req.date} (${req.days})`,
        timestamp: req.updatedAt || req.createdAt || '',
      })
    }

    return items
      .sort((a, b) => {
        const tA = a.timestamp ? Date.parse(a.timestamp) || 0 : 0
        const tB = b.timestamp ? Date.parse(b.timestamp) || 0 : 0
        return tB - tA
      })
      .slice(0, 8)
  }, [attendanceLogs, shiftAssignments, employees, shifts, requests])

  const computedDepartments = useMemo(() => {
    return departments.map((dept) => {
      const deptEmployees = employees.filter((e) => e.department === dept.name)
      const actualHeadcount = deptEmployees.length > 0 ? deptEmployees.length : dept.headcount

      const deptLogs = attendanceLogs.filter((l) => l.department === dept.name)
      const deptOnTime = deptLogs.filter((l) => l.status === 'Đúng giờ').length
      const actualRate =
        deptLogs.length > 0 ? Number(((deptOnTime / deptLogs.length) * 100).toFixed(1)) : dept.attendanceRate

      return {
        ...dept,
        actualHeadcount,
        actualRate,
        totalLogsCount: deptLogs.length,
      }
    })
  }, [departments, employees, attendanceLogs])

  const reportMetrics = useMemo(() => {
    const monthLogs = currentMonthPrefix
      ? attendanceLogs.filter((log) => log.workDate.startsWith(currentMonthPrefix))
      : attendanceLogs
    const totalMinutesMonth = monthLogs.reduce((sum, log) => sum + (log.totalMinutes || 0), 0)

    const onTimeMonth = monthLogs.filter((l) => l.status === 'Đúng giờ').length
    const onTimeRateMonth =
      monthLogs.length > 0 ? ((onTimeMonth / monthLogs.length) * 100).toFixed(1).replace('.', ',') : '0'

    let overtimeMinutes = 0
    for (const log of monthLogs) {
      if (log.totalMinutes > 0) {
        const matchedShift = shifts.find((s) => s.name === log.shift)
        if (matchedShift) {
          const shiftCalc = computeWorkedMinutes(matchedShift.start, matchedShift.end, 0, true)
          if (shiftCalc.valid && log.totalMinutes > shiftCalc.totalMinutes) {
            overtimeMinutes += log.totalMinutes - shiftCalc.totalMinutes
          }
        } else if (log.totalMinutes > 8 * 60) {
          overtimeMinutes += log.totalMinutes - 8 * 60
        }
      }
    }

    const approvedLeavesCount = requests.filter((r) => r.status === 'Đã duyệt').length
    const leaveApprovalRate = requests.length > 0 ? Math.round((approvedLeavesCount / requests.length) * 100) : 0

    return {
      monthRecordsCount: monthLogs.length,
      totalHoursFormatted: formatMinutesToHoursText(totalMinutesMonth),
      onTimeRateMonth: `${onTimeRateMonth}%`,
      overtimeFormatted: formatMinutesToHoursText(overtimeMinutes),
      approvedLeavesCount,
      totalLeavesCount: requests.length,
      leaveApprovalRate: `${leaveApprovalRate}%`,
    }
  }, [attendanceLogs, currentMonthPrefix, shifts, requests])

  const allDepartmentNames = useMemo(
    () =>
      Array.from(
        new Set([
          'Phòng Kỹ thuật',
          'Phòng Marketing',
          'Phòng Nhân sự',
          'Phòng Vận hành',
          'Phòng Kinh doanh',
          ...departments.map((d) => d.name),
        ]),
      ),
    [departments],
  )

  const filteredEmployees = useMemo(
    () =>
      employees.filter((emp) => {
        const matchDept = empDeptFilter === 'Tất cả' || emp.department === empDeptFilter
        const q = empSearch.toLowerCase().trim()
        const matchQuery =
          !q ||
          emp.name.toLowerCase().includes(q) ||
          emp.email.toLowerCase().includes(q) ||
          emp.role.toLowerCase().includes(q) ||
          emp.code.toLowerCase().includes(q)
        return matchDept && matchQuery
      }),
    [employees, empDeptFilter, empSearch],
  )

  const filteredAttendance = useMemo(
    () =>
      attendanceLogs.filter((log) => {
        const matchStatus =
          attFilter === 'Tất cả'
            ? true
            : attFilter === 'Đang trong ca'
              ? log.checkOut === null && log.status !== 'Vắng mặt'
              : log.status === attFilter
        const matchDate = !attDateFilter || log.workDate === attDateFilter
        return matchStatus && matchDate
      }),
    [attendanceLogs, attFilter, attDateFilter],
  )

  const filteredLeaves = useMemo(
    () => requests.filter((req) => leaveFilter === 'Tất cả' || req.status === leaveFilter),
    [requests, leaveFilter],
  )

  function handleExportCsv() {
    const recordsToExport = filteredAttendance

    if (recordsToExport.length === 0 && employees.length === 0) {
      setNotice('Không có dữ liệu phù hợp để xuất báo cáo CSV.')
      return
    }

    try {
      const exportDate = attDateFilter || todayIso || formatDateToIso(new Date())
      const headers = [
        'Mã bản ghi',
        'Ngày làm việc',
        'Họ và tên nhân viên',
        'Phòng ban',
        'Ca làm việc',
        'Giờ vào ca',
        'Giờ tan ca',
        'Nghỉ giữa giờ (Phút)',
        'Tổng thời gian',
        'Số phút thực làm',
        'Trạng thái chuyên cần',
      ]

      const rows =
        recordsToExport.length > 0
          ? recordsToExport.map((rec) => [
              rec.id,
              rec.workDate,
              rec.name,
              rec.department,
              rec.shift,
              rec.checkIn,
              rec.checkOut ?? 'Đang trong ca',
              rec.breakMinutes,
              rec.totalHours,
              rec.totalMinutes,
              rec.status,
            ])
          : employees.map((emp) => [
              emp.code,
              exportDate,
              emp.name,
              emp.department,
              emp.shift,
              '--',
              '--',
              0,
              '0h 00m',
              0,
              emp.status,
            ])

      const csvLines = [headers.map(escapeCsvCell).join(','), ...rows.map((row) => row.map(escapeCsvCell).join(','))]
      const csvContent = '\uFEFF' + csvLines.join('\r\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })

      const fileName = `ShiftFlow_BaoCao_${exportDate}.csv`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setNotice(`Đã tạo và tải xuống tệp báo cáo ${fileName} thành công.`)
    } catch {
      setNotice('Đã xảy ra lỗi khi tạo tệp CSV. Vui lòng thử lại.')
    }
  }

  return (
    <div className="dashboard">
      {drawer && (
        <button
          className="drawer-overlay"
          aria-label="Đóng điều hướng"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside className={`sidebar ${drawer ? 'is-open' : ''}`} aria-label="Điều hướng chính">
        <a className="sidebar-brand" href="/dashboard">
          <ShiftFlowMark className="sidebar-logo" />
          <span>
            ShiftFlow<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-label">KHÔNG GIAN LÀM VIỆC</div>
        <nav>
          {navigation.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${active === item.label ? 'active' : ''}`}
              onClick={() => navigate(item.label)}
              aria-current={active === item.label ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.label === 'Đơn nghỉ phép' && pendingCount > 0 && (
                <span className="nav-count">{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">
              <Icon name="help" />
            </span>
            <strong>Luôn sẵn sàng hỗ trợ</strong>
            <p>Cùng bạn vận hành hiệu quả hơn.</p>
            <button onClick={() => setModal('support')}>
              Trung tâm trợ giúp <Icon name="arrow" />
            </button>
          </div>
          <button className={`nav-item ${active === 'Cài đặt' ? 'active' : ''}`} onClick={() => navigate('Cài đặt')}>
            <Icon name="settings" />
            <span>Cài đặt</span>
          </button>
          <div className="sidebar-profile">
            <Avatar initials={computeInitials(userName)} />
            <div>
              <strong>{userName}</strong>
              <span>{userEmail || 'Đang xác thực...'}</span>
            </div>
            <button className="icon-button" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => setModal('logout')}>
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="Mở điều hướng"
              aria-expanded={drawer}
              onClick={() => setDrawer(!drawer)}
            >
              <Icon name="menu" />
            </button>
            <span className="breadcrumb-home">{settings.workspaceName}</span>
            <Icon name="chevron" />
            <strong>{active}</strong>
          </div>
          <div className="topbar-right">
            <span className="header-date">
              <Icon name="calendar" />
              {currentDateString || 'Đang tải ngày...'}
            </span>
            <span className="header-divider" />
            <button className="icon-button" aria-label="Tìm kiếm" onClick={() => setModal('search')}>
              <Icon name="search" />
            </button>
            <button className="icon-button notification-button" aria-label="Thông báo mới" onClick={() => setModal('notifications')}>
              <Icon name="bell" />
              {realActivities.length > 0 && <i />}
            </button>
            <span className="header-divider" />
            <button className="header-user" onClick={() => setModal('profile')}>
              <Avatar initials={computeInitials(userName)} />
              <span>{userName.split(' ').slice(-2).join(' ')}</span>
              <Icon name="chevron" />
            </button>
          </div>
        </header>

        <main className="dashboard-content">
          <div className="page-heading">
            <div>
              <div className="page-eyebrow">
                <span /> {settings.workspaceName.toUpperCase()}
              </div>
              <h1>{active}</h1>
              <p>
                {active === 'Tổng quan' && 'Theo dõi tình hình nhân sự và dữ liệu chuyên cần theo thời gian thực.'}
                {active === 'Nhân viên' && 'Quản lý hồ sơ, vai trò và phân bổ nhân sự theo từng phòng ban.'}
                {active === 'Phòng ban' && 'Cơ cấu tổ chức, trưởng bộ phận và hiệu suất chuyên cần thực tế.'}
                {active === 'Lịch làm việc' && 'Quản lý mẫu định nghĩa ca và phân công lịch làm việc theo tuần.'}
                {active === 'Chấm công' && 'Ghi nhận giờ vào ca, tan ca và tính toán thời gian làm việc thực tế.'}
                {active === 'Đơn nghỉ phép' && 'Tạo mới và xét duyệt các yêu cầu nghỉ phép, đổi ca của nhân viên.'}
                {active === 'Báo cáo' && 'Phân tích chuyên sâu dữ liệu chấm công, giờ làm thực tế và xuất báo cáo CSV.'}
                {active === 'Cài đặt' && 'Thiết lập quy tắc ca làm, múi giờ và thông báo lưu trữ trên cơ sở dữ liệu.'}
              </p>
            </div>
            <div className="heading-actions">
              {active === 'Nhân viên' ? (
                isAdmin && (
                  <button className="primary-button" onClick={() => setModal('add-employee')}>
                    <Icon name="plus" /> Thêm nhân viên
                  </button>
                )
              ) : active === 'Phòng ban' ? (
                isAdmin && (
                  <button className="primary-button" onClick={() => setModal('add-department')}>
                    <Icon name="plus" /> Thêm phòng ban
                  </button>
                )
              ) : active === 'Chấm công' ? (
                <>
                  <button className="secondary-button" onClick={handleExportCsv}>
                    <Icon name="download" /> Xuất CSV
                  </button>
                  <button className="primary-button" onClick={openCheckInModal}>
                    <Icon name="plus" /> Vào ca / Chấm công
                  </button>
                </>
              ) : active === 'Đơn nghỉ phép' ? (
                <button className="primary-button" onClick={() => setModal('create-leave')}>
                  <Icon name="plus" /> Tạo đơn nghỉ phép
                </button>
              ) : active === 'Báo cáo' ? (
                <button className="primary-button" onClick={handleExportCsv}>
                  <Icon name="download" /> Xuất báo cáo CSV
                </button>
              ) : (
                <>
                  <span className="demo-indicator">{isLoading ? 'Đang đồng bộ...' : 'RLS & Realtime Active'}</span>
                  {isAdmin && (
                    <button className="primary-button" onClick={() => setModal('create')}>
                      <Icon name="plus" /> Tạo mẫu ca làm
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {fetchError && (
            <div
              className="panel"
              style={{
                padding: '14px 18px',
                marginBottom: 18,
                borderLeft: '4px solid #ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <strong style={{ color: '#b91c1c' }}>Cảnh báo truy vấn cơ sở dữ liệu</strong>
                <p style={{ margin: '4px 0 0', fontSize: 13 }}>{fetchError}</p>
              </div>
              <button type="button" className="secondary-button" onClick={() => fetchSupabaseData(true, todayIso)}>
                Thử lại
              </button>
            </div>
          )}

          {active === 'Tổng quan' && (
            <>
              <section className="metrics-grid" aria-label="Chỉ số tổng quan">
                {metrics.map((metric) => (
                  <article className="metric-card" key={metric.label}>
                    <div className="metric-top">
                      <span>{metric.label}</span>
                      <span className={`metric-icon ${metric.tone}`}>
                        <Icon name={metric.icon} />
                      </span>
                    </div>
                    <strong className="metric-value">{isLoading ? '...' : metric.value}</strong>
                    <p>{metric.description}</p>
                    <div className={`metric-foot ${metric.tone}`}>
                      {metric.tone === 'teal' ? <span className="trend-arrow">↗</span> : <span className="tiny-dot" />}
                      {metric.trend}
                    </div>
                  </article>
                ))}
              </section>

              <div className="content-grid analytics-grid">
                <section className="panel attendance-panel">
                  <PanelHeading
                    title="Tình hình chấm công"
                    subtitle={
                      chartData.days.length >= 7
                        ? period === 'week'
                          ? `Thống kê thực tế 7 ngày gần nhất (${chartData.days[0]?.dateLabel} – ${chartData.days[6]?.dateLabel})`
                          : `Thống kê thực tế 7 ngày trước đó (${chartData.days[0]?.dateLabel} – ${chartData.days[6]?.dateLabel})`
                        : 'Đang tính toán chu kỳ 7 ngày...'
                    }
                    action={
                      <div className="custom-dropdown" ref={dropdownRef}>
                        <button
                          type="button"
                          className={`dropdown-trigger ${dropdownOpen ? 'is-open' : ''}`}
                          onClick={() => setDropdownOpen((o) => !o)}
                          aria-expanded={dropdownOpen}
                        >
                          <Icon name="calendar" />
                          <span>{periodOptions.find((o) => o.value === period)?.label}</span>
                          <Icon name="chevron" className="chevron-down" />
                        </button>
                        {dropdownOpen && (
                          <div className="dropdown-menu" role="listbox">
                            {periodOptions.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                role="option"
                                aria-selected={period === opt.value}
                                className={`dropdown-item ${period === opt.value ? 'selected' : ''}`}
                                onClick={() => {
                                  setPeriod(opt.value)
                                  setDropdownOpen(false)
                                }}
                              >
                                <span>{opt.label}</span>
                                {period === opt.value && <Icon name="tick" className="check-mark" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    }
                  />
                  <div className="chart-legend">
                    <span><i className="legend-teal" /> Đúng giờ</span>
                    <span><i className="legend-amber" /> Đi trễ</span>
                    <span><i className="legend-gray" /> Vắng mặt</span>
                  </div>
                  <div className="chart-container">
                    <div className="chart-y-axis">
                      {chartData.yTicks.map((n, idx) => (
                        <span key={`${n}-${idx}`}>{n}</span>
                      ))}
                    </div>
                    <div className="chart-plot">
                      <div className="chart-gridlines">
                        {[0, 1, 2, 3, 4].map((n) => (
                          <i key={n} />
                        ))}
                      </div>
                      <div className="chart-bars">
                        {chartData.days.map((day) => {
                          const maxVal = chartData.yAxisMax || 1
                          return (
                            <div className={`bar-column ${day.isToday ? 'today' : ''}`} key={day.isoDate}>
                              <div
                                className="bar-track"
                                tabIndex={0}
                                aria-label={`${day.day} (${day.dateLabel}): ${day.onTime} đúng giờ, ${day.late} đi trễ, ${day.absent} vắng mặt`}
                              >
                                <div className="bar-stack">
                                  <div className="bar-absent" style={{ height: `${(day.absent / maxVal) * 100}%` }} />
                                  <div className="bar-late" style={{ height: `${(day.late / maxVal) * 100}%` }} />
                                  <div className="bar-ontime" style={{ height: `${(day.onTime / maxVal) * 100}%` }} />
                                </div>
                                <span className="chart-tooltip">
                                  {day.onTime} đúng giờ · {day.late} trễ · {day.absent} vắng
                                </span>
                              </div>
                              <span className="bar-label">
                                {day.day}
                                <small>{day.dateLabel}</small>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="chart-footer">
                    <span><span className="tiny-dot" /> Tỷ lệ đúng giờ trung bình ({chartData.totalRecordsInPeriod} lượt chấm công)</span>
                    <strong>{chartData.avgOnTimeRate}<span> trong kỳ</span></strong>
                  </div>
                </section>

                <section className="panel schedule-panel">
                  <PanelHeading
                    title="Lịch phân công hôm nay"
                    subtitle={todayIso ? `Phân công thực tế ngày ${formatShortDate(todayIso)}` : 'Phân công thực tế hôm nay'}
                    action={<span className="count-label">{shifts.length} mẫu ca</span>}
                  />
                  {shifts.length === 0 ? (
                    <div className="table-note">
                      <Icon name="calendar" /> Chưa có mẫu ca làm việc nào được thiết lập.
                    </div>
                  ) : (
                    <div className="shift-list">
                      {shifts.slice(0, 3).map((shift, i) => {
                        const todayAssignedIds = shiftAssignments
                          .filter(
                            (a) => a.workDate === todayIso && a.shiftId === shift.id && a.status !== 'Đã hủy',
                          )
                          .map((a) => a.employeeId)

                        const assignedEmps = employees.filter((e) => todayAssignedIds.includes(e.id))

                        return (
                          <div className={`shift-item ${i === 0 ? 'ongoing' : ''}`} key={shift.id ?? `${shift.name}-${i}`}>
                            <span className="shift-icon">
                              <Icon name={shift.icon} />
                            </span>
                            <div className="shift-details">
                              <div className="shift-title">
                                <h3>{shift.name}</h3>
                                <span className={`badge ${assignedEmps.length > 0 ? 'success' : 'neutral'}`}>
                                  {assignedEmps.length}/{shift.count} định biên
                                </span>
                              </div>
                              <p>
                                <Icon name="clock" /> {shift.start} – {shift.end}
                              </p>
                              <div className="shift-employees">
                                {assignedEmps.length > 0 ? (
                                  <>
                                    <div className="avatar-stack">
                                      {assignedEmps.slice(0, 3).map((emp) => (
                                        <Avatar key={emp.id} initials={emp.initials} tone={emp.tone} />
                                      ))}
                                    </div>
                                    <span>{assignedEmps.length} nhân viên được phân ca hôm nay</span>
                                  </>
                                ) : (
                                  <span>Chưa có phân công ngày hôm nay</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <button className="panel-bottom-link" onClick={() => navigate('Lịch làm việc')}>
                    Quản lý lịch tuần & Phân công <Icon name="arrow" />
                  </button>
                </section>
              </div>

              <div className="content-grid lower-grid">
                <section className="panel leave-panel">
                  <PanelHeading
                    title="Đơn nghỉ phép gần đây"
                    action={
                      <button className="text-button" onClick={() => navigate('Đơn nghỉ phép')}>
                        Xem tất cả <Icon name="arrow" />
                      </button>
                    }
                  />
                  {requests.length === 0 ? (
                    <div className="table-note">
                      <Icon name="file" /> Chưa có đơn nghỉ phép nào trong cơ sở dữ liệu.
                    </div>
                  ) : (
                    <div className="request-table">
                      <div className="request-table-head">
                        <span>NHÂN VIÊN</span>
                        <span>THỜI GIAN NGHỈ</span>
                        <span>TRẠNG THÁI</span>
                        <span />
                      </div>
                      {requests.slice(0, 3).map((r) => (
                        <button className="request-row" key={r.id} onClick={() => setReview(r.id)}>
                          <span className="employee-cell">
                            <Avatar initials={r.initials} tone={r.tone} />
                            <span>
                              <strong>{r.name}</strong>
                              <small>{r.type}</small>
                            </span>
                          </span>
                          <span className="leave-date">
                            {r.date}
                            <small>{r.days}</small>
                          </span>
                          <span className={`badge ${r.status === 'Đã duyệt' ? 'success' : r.status === 'Từ chối' ? 'danger' : 'warning'}`}>
                            {r.status}
                          </span>
                          <Icon name="chevron" />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="table-note">
                    <Icon name="file" /> Hệ thống hiện có {pendingCount} đơn nghỉ phép đang chờ phê duyệt.
                  </div>
                </section>

                <section className="panel activity-panel">
                  <PanelHeading
                    title="Hoạt động gần đây"
                    action={
                      <button className="text-button" onClick={() => setModal('activity')}>
                        Xem tất cả <Icon name="arrow" />
                      </button>
                    }
                  />
                  <ActivityFeedList items={realActivities.slice(0, 3)} nowMs={nowMs} />
                </section>
              </div>
            </>
          )}

          {active === 'Nhân viên' && (
            <section className="panel">
              <div className="module-toolbar">
                <div className="search-box">
                  <Icon name="search" />
                  <input
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    placeholder="Tìm theo mã NV, tên, email hoặc chức vụ..."
                  />
                </div>
                <div className="filter-pills">
                  {['Tất cả', ...allDepartmentNames].map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      className={`pill-btn ${empDeptFilter === dept ? 'active' : ''}`}
                      onClick={() => setEmpDeptFilter(dept)}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>
              {isLoading ? (
                <div className="table-note">
                  <Icon name="clock" /> Đang tải danh sách nhân sự từ cơ sở dữ liệu...
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="table-note">
                  <Icon name="users" /> Không tìm thấy nhân viên nào phù hợp với bộ lọc hiện tại.
                </div>
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Mã NV</th>
                        <th>Nhân viên</th>
                        <th>Chức vụ</th>
                        <th>Phòng ban</th>
                        <th>Ca mặc định</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map((emp) => (
                        <tr key={emp.id}>
                          <td><strong>{emp.code}</strong></td>
                          <td>
                            <div className="employee-cell">
                              <Avatar initials={emp.initials} tone={emp.tone} />
                              <span>
                                <strong>{emp.name}</strong>
                                <small>{emp.email}</small>
                              </span>
                            </div>
                          </td>
                          <td>{emp.role}</td>
                          <td>{emp.department}</td>
                          <td>{emp.shift}</td>
                          <td>
                            <span className={`badge ${emp.status === 'Đang hoạt động' ? 'success' : 'warning'}`}>
                              {emp.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {active === 'Phòng ban' && (
            <>
              {computedDepartments.length === 0 ? (
                <section className="panel">
                  <div className="table-note">
                    <Icon name="building" /> Chưa có dữ liệu phòng ban trong cơ sở dữ liệu.
                  </div>
                </section>
              ) : (
                <div className="dept-grid">
                  {computedDepartments.map((d) => (
                    <article className="dept-card" key={d.id}>
                      <div className="dept-head">
                        <div>
                          <h3>{d.name}</h3>
                          <p>Trưởng bộ phận: {d.manager}</p>
                        </div>
                        <span className={`metric-icon ${d.tone}`}>
                          <Icon name="building" />
                        </span>
                      </div>
                      <div className="dept-progress-wrap">
                        <div className="dept-progress-label">
                          <span>
                            Tỷ lệ chuyên cần {d.totalLogsCount > 0 ? ` (${d.totalLogsCount} bản ghi)` : ''}
                          </span>
                          <strong>{d.actualRate}%</strong>
                        </div>
                        <div className="dept-progress-bar">
                          <div className="dept-progress-fill" style={{ width: `${Math.min(100, Math.max(0, d.actualRate))}%` }} />
                        </div>
                      </div>
                      <div className="dept-footer">
                        <span><strong>{d.actualHeadcount}</strong> nhân sự</span>
                        <span>{d.activeShifts}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {active === 'Lịch làm việc' && (
            <WeeklyScheduleModule
              shifts={shifts}
              employees={employees}
              departments={allDepartmentNames}
              assignments={shiftAssignments}
              leaveRequests={requests}
              policyConfig={{
                maxDailyHours: settings.maxDailyHours,
                maxWeeklyHours: settings.maxWeeklyHours,
                minRestHours: settings.minRestHours,
                blockOnOvertime: settings.blockOnOvertime,
                blockOnRestViolation: settings.blockOnRestViolation,
              }}
              todayIso={todayIso}
              isLoading={isLoading}
              isAdmin={isAdmin}
              onRefresh={() => fetchSupabaseData(false, todayIso)}
              onNotify={(msg) => setNotice(msg)}
              onOpenCreateShiftTemplate={() => setModal('create')}
            />
          )}

          {active === 'Chấm công' && (
            <AttendanceManagementModule
              attendanceLogs={attendanceLogs}
              employees={employees}
              shifts={shifts}
              departments={allDepartmentNames}
              assignments={shiftAssignments}
              todayIso={todayIso}
              maxLateMinutes={settings.maxLateMinutes}
              isLoading={isLoading}
              isAdmin={isAdmin}
              onRefresh={() => fetchSupabaseData(false, todayIso)}
              onNotify={(msg) => setNotice(msg)}
              onOpenCheckInModal={openCheckInModal}
              onOpenCheckOutModal={openCheckOutModal}
              onExportCsv={handleExportCsv}
            />
          )}

          {active === 'Đơn nghỉ phép' && (
            <LeaveManagementModule
              requests={requests}
              employees={employees}
              departments={allDepartmentNames}
              assignments={shiftAssignments}
              todayIso={todayIso}
              isLoading={isLoading}
              isAdmin={isAdmin}
              onRefresh={() => fetchSupabaseData(false, todayIso)}
              onNotify={(msg) => setNotice(msg)}
            />
          )}

          {active === 'Báo cáo' && (
            <>
              <section className="metrics-grid">
                <article className="metric-card">
                  <div className="metric-top">
                    <span>Tổng giờ công tháng này</span>
                    <span className="metric-icon teal">
                      <Icon name="clock" />
                    </span>
                  </div>
                  <strong className="metric-value">{reportMetrics.totalHoursFormatted}</strong>
                  <p>Tổng hợp từ {reportMetrics.monthRecordsCount} bản ghi chấm công</p>
                  <div className="metric-foot teal">
                    <span className="trend-arrow">↗</span> Dữ liệu thực tế{' '}
                    {currentMonthPrefix ? `tháng ${currentMonthPrefix.split('-')[1]}/${currentMonthPrefix.split('-')[0]}` : 'trong kỳ'}
                  </div>
                </article>
                <article className="metric-card">
                  <div className="metric-top">
                    <span>Tỷ lệ đúng giờ toàn công ty</span>
                    <span className="metric-icon blue">
                      <Icon name="check" />
                    </span>
                  </div>
                  <strong className="metric-value">{reportMetrics.onTimeRateMonth}</strong>
                  <p>Ngưỡng trễ cho phép: {settings.maxLateMinutes} phút</p>
                  <div className="metric-foot blue">
                    <span className="tiny-dot" /> Tính từ nhật ký chấm công thực
                  </div>
                </article>
                <article className="metric-card">
                  <div className="metric-top">
                    <span>Giờ làm vượt khung ca (OT)</span>
                    <span className="metric-icon orange">
                      <Icon name="sun" />
                    </span>
                  </div>
                  <strong className="metric-value">{reportMetrics.overtimeFormatted}</strong>
                  <p>Tổng thời gian vượt giờ chuẩn của ca</p>
                  <div className="metric-foot orange">
                    <span className="tiny-dot" /> Tự động đối chiếu theo ca
                  </div>
                </article>
                <article className="metric-card">
                  <div className="metric-top">
                    <span>Đơn nghỉ phép đã duyệt</span>
                    <span className="metric-icon purple">
                      <Icon name="file" />
                    </span>
                  </div>
                  <strong className="metric-value">
                    {reportMetrics.approvedLeavesCount}/{reportMetrics.totalLeavesCount}
                  </strong>
                  <p>Tỷ lệ duyệt: {reportMetrics.leaveApprovalRate}</p>
                  <div className="metric-foot purple">
                    <span className="tiny-dot" /> Đồng bộ từ bảng leave_requests
                  </div>
                </article>
              </section>

              <section className="panel" style={{ paddingBottom: 22 }}>
                <PanelHeading
                  title="So sánh tỷ lệ chuyên cần theo phòng ban"
                  subtitle="Tính toán trực tiếp từ hồ sơ nhân sự và dữ liệu chấm công"
                />
                {computedDepartments.length === 0 ? (
                  <div className="table-note">
                    <Icon name="building" /> Chưa có dữ liệu phòng ban để thống kê.
                  </div>
                ) : (
                  <div style={{ padding: '20px 22px 0', display: 'grid', gap: 16 }}>
                    {computedDepartments.map((d) => (
                      <div className="dept-progress-wrap" key={d.id}>
                        <div className="dept-progress-label">
                          <strong>{d.name} ({d.actualHeadcount} nhân sự)</strong>
                          <strong>{d.actualRate}% đúng giờ</strong>
                        </div>
                        <div className="dept-progress-bar">
                          <div className="dept-progress-fill" style={{ width: `${Math.min(100, Math.max(0, d.actualRate))}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {active === 'Cài đặt' && (
            <div className="settings-grid">
              <section className="panel">
                <PanelHeading
                  title="Cấu hình không gian làm việc"
                  subtitle="Lưu trữ trực tiếp vào bảng workspace_settings trên Supabase"
                />
                <form className="settings-body" onSubmit={handleSaveSettings}>
                  <div className="settings-field">
                    <label>Tên không gian làm việc</label>
                    <input
                      value={settings.workspaceName}
                      onChange={(e) => setSettings({ ...settings, workspaceName: e.target.value })}
                      disabled={!isAdmin}
                      required
                    />
                  </div>
                  <div className="settings-field">
                    <label>Múi giờ hệ thống</label>
                    <input
                      value={settings.timezone}
                      onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                      disabled={!isAdmin}
                      required
                    />
                  </div>
                  <div className="settings-field">
                    <label>Thời gian cho phép trễ tối đa (Phút)</label>
                    <input
                      type="number"
                      min={0}
                      max={240}
                      value={settings.maxLateMinutes}
                      onChange={(e) => setSettings({ ...settings, maxLateMinutes: Number(e.target.value) })}
                      disabled={!isAdmin}
                      required
                    />
                  </div>
                  <div className="settings-field">
                    <label>Giờ làm tối đa trong ngày (Cấu hình ca làm)</label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={settings.maxDailyHours}
                      onChange={(e) => setSettings({ ...settings, maxDailyHours: Number(e.target.value) })}
                      disabled={!isAdmin}
                      required
                    />
                  </div>
                  <div className="settings-field">
                    <label>Giờ làm tối đa trong tuần (Cấu hình ca làm)</label>
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={settings.maxWeeklyHours}
                      onChange={(e) => setSettings({ ...settings, maxWeeklyHours: Number(e.target.value) })}
                      disabled={!isAdmin}
                      required
                    />
                  </div>
                  <div className="settings-field">
                    <label>Thời gian nghỉ tối thiểu giữa hai ca (Giờ)</label>
                    <input
                      type="number"
                      min={0}
                      max={48}
                      value={settings.minRestHours}
                      onChange={(e) => setSettings({ ...settings, minRestHours: Number(e.target.value) })}
                      disabled={!isAdmin}
                      required
                    />
                  </div>
                  <div>
                    <button type="submit" className="primary-button" disabled={!isAdmin || isSubmitting}>
                      {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </form>
              </section>

              <section className="panel">
                <PanelHeading
                  title="Tùy chọn thông báo & Tự động hóa"
                  subtitle="Cấu hình được giữ nguyên khi tải lại trang hoặc đăng nhập lại"
                />
                <div className="settings-body">
                  <div className="toggle-row">
                    <div>
                      <strong>Thông báo qua Email khi có đơn nghỉ phép</strong>
                      <span>Gửi email tức thì cho Quản trị viên khi nhân viên nộp đơn</span>
                    </div>
                    <button
                      type="button"
                      className={`switch-btn ${settings.notifyLeaveEmail ? 'on' : ''}`}
                      aria-pressed={settings.notifyLeaveEmail}
                      onClick={() => handleToggleSetting('notifyLeaveEmail')}
                    >
                      <i />
                    </button>
                  </div>
                  <div className="toggle-row">
                    <div>
                      <strong>Cảnh báo nhân sự đi trễ quá hạn mức</strong>
                      <span>Tự động đánh dấu Đi trễ nếu vào ca sau {settings.maxLateMinutes} phút</span>
                    </div>
                    <button
                      type="button"
                      className={`switch-btn ${settings.alertLateThreshold ? 'on' : ''}`}
                      aria-pressed={settings.alertLateThreshold}
                      onClick={() => handleToggleSetting('alertLateThreshold')}
                    >
                      <i />
                    </button>
                  </div>
                  <div className="toggle-row">
                    <div>
                      <strong>Chặn lưu phân công khi vượt hạn mức giờ làm</strong>
                      <span>Chặn phân ca nếu vượt quá {settings.maxDailyHours}h/ngày hoặc {settings.maxWeeklyHours}h/tuần</span>
                    </div>
                    <button
                      type="button"
                      className={`switch-btn ${settings.blockOnOvertime ? 'on' : ''}`}
                      aria-pressed={settings.blockOnOvertime}
                      onClick={() => {
                        if (!isAdmin) return
                        const nextVal = !settings.blockOnOvertime
                        setSettings({ ...settings, blockOnOvertime: nextVal })
                        const supabase = createClient()
                        supabase.from('workspace_settings').update({ block_on_overtime: nextVal }).eq('id', 1).then()
                      }}
                    >
                      <i />
                    </button>
                  </div>
                  <div className="toggle-row">
                    <div>
                      <strong>Chặn lưu phân công khi vi phạm thời gian nghỉ giữa ca</strong>
                      <span>Chặn phân ca nếu khoảng cách giữa hai ca nhỏ hơn {settings.minRestHours} giờ</span>
                    </div>
                    <button
                      type="button"
                      className={`switch-btn ${settings.blockOnRestViolation ? 'on' : ''}`}
                      aria-pressed={settings.blockOnRestViolation}
                      onClick={() => {
                        if (!isAdmin) return
                        const nextVal = !settings.blockOnRestViolation
                        setSettings({ ...settings, blockOnRestViolation: nextVal })
                        const supabase = createClient()
                        supabase.from('workspace_settings').update({ block_on_rest_violation: nextVal }).eq('id', 1).then()
                      }}
                    >
                      <i />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          <footer className="dashboard-footer">
            <span>© 2026 ShiftFlow. Mọi quyền được bảo lưu.</span>
            <span>
              <span className="tiny-dot" /> Không gian làm việc của bạn, vận hành tốt hơn.
            </span>
          </footer>
        </main>
      </div>

      {notice && (
        <div className="toast" role="status">
          <Icon name="check" />
          {notice}
          <button className="icon-button" aria-label="Đóng" onClick={() => setNotice('')}>
            <Icon name="close" />
          </button>
        </div>
      )}

      {modal && (
        <Modal
          title={
            ({
              create: 'Tạo mẫu ca làm mới',
              'add-employee': 'Thêm nhân viên mới',
              'add-department': 'Thêm phòng ban mới',
              'manual-checkin': 'Ghi nhận Vào ca / Chấm công',
              'create-leave': 'Tạo đơn xin nghỉ phép',
              notifications: 'Thông báo hệ thống',
              search: 'Tìm kiếm nhanh trong ShiftFlow',
              profile: 'Thông tin tài khoản',
              logout: 'Xác nhận đăng xuất',
              support: 'Trung tâm trợ giúp',
              activity: 'Hoạt động gần đây',
            } as Record<string, string>)[modal] || 'Thông tin'
          }
          onClose={() => setModal(null)}
        >
          {modal === 'create' ? (
            <form className="shift-form" onSubmit={createShift}>
              <label>
                Tên mẫu ca làm
                <input name="name" placeholder="Ví dụ: Ca đêm, Ca gãy tăng cường..." required maxLength={50} autoFocus />
              </label>
              <div className="form-split">
                <label>
                  Giờ bắt đầu
                  <input type="time" name="start" defaultValue="08:00" required />
                </label>
                <label>
                  Giờ kết thúc
                  <input type="time" name="end" defaultValue="12:00" required />
                </label>
              </div>
              <label>
                Số nhân viên định biên mẫu
                <input type="number" name="count" min="1" max="200" defaultValue="6" required />
              </label>
              <button className="primary-button" type="submit" disabled={isSubmitting}>
                <Icon name="plus" /> {isSubmitting ? 'Đang lưu...' : 'Lưu mẫu ca làm'}
              </button>
            </form>
          ) : modal === 'add-employee' ? (
            <form className="shift-form" onSubmit={handleAddEmployee}>
              <label>
                Họ và tên nhân viên
                <input name="name" placeholder="Ví dụ: Nguyễn Văn An" required autoFocus />
              </label>
              <label>
                Email công việc
                <input type="email" name="email" placeholder="an.nguyen@shiftflow.com" required />
              </label>
              <div className="form-split">
                <label>
                  Chức vụ
                  <input name="role" placeholder="Chuyên viên..." required />
                </label>
                <label>
                  Phòng ban
                  <select name="department" defaultValue="Phòng Kỹ thuật">
                    {allDepartmentNames.map((deptName) => (
                      <option key={deptName} value={deptName}>{deptName}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Ca làm việc mặc định
                <select name="shift" defaultValue="Ca sáng">
                  {(shifts.length > 0 ? shifts : [
                    { name: 'Ca sáng', start: '08:00', end: '12:00' },
                    { name: 'Ca chiều', start: '13:00', end: '17:00' },
                    { name: 'Ca tối', start: '18:00', end: '22:00' },
                  ]).map((s) => (
                    <option key={s.name} value={s.name}>{s.name} ({s.start} – {s.end})</option>
                  ))}
                </select>
              </label>
              <button className="primary-button" type="submit" disabled={isSubmitting}>
                <Icon name="plus" /> {isSubmitting ? 'Đang lưu...' : 'Thêm vào danh sách'}
              </button>
            </form>
          ) : modal === 'add-department' ? (
            <form className="shift-form" onSubmit={handleAddDepartment}>
              <label>
                Tên phòng ban
                <input name="name" placeholder="Ví dụ: Phòng Chăm sóc Khách hàng" required autoFocus />
              </label>
              <div className="form-split">
                <label>
                  Trưởng bộ phận
                  <input name="manager" placeholder="Họ tên quản lý" required />
                </label>
                <label>
                  Số lượng nhân sự định biên
                  <input type="number" name="headcount" defaultValue="4" min="1" required />
                </label>
              </div>
              <label>
                Các ca hoạt động chính
                <input name="activeShifts" defaultValue="Ca sáng, Ca chiều" required />
              </label>
              <button className="primary-button" type="submit" disabled={isSubmitting}>
                <Icon name="plus" /> {isSubmitting ? 'Đang tạo...' : 'Tạo phòng ban'}
              </button>
            </form>
          ) : modal === 'manual-checkin' ? (
            <form className="shift-form" onSubmit={handleManualCheckIn}>
              <label>
                Chọn nhân viên
                <select
                  name="employeeId"
                  value={selectedCheckInEmpId}
                  onChange={(e) => {
                    const idVal = e.target.value
                    setSelectedCheckInEmpId(idVal)
                    const emp = employees.find((item) => String(item.id) === idVal)
                    if (emp?.shift) setSelectedCheckInShift(emp.shift)
                  }}
                  required
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.code} – {emp.name} ({emp.department})
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-split">
                <label>
                  Ngày làm việc
                  <input type="date" name="workDate" defaultValue={todayIso} required />
                </label>
                <label>
                  Ca làm việc
                  <select
                    name="shift"
                    value={selectedCheckInShift}
                    onChange={(e) => setSelectedCheckInShift(e.target.value)}
                  >
                    {(shifts.length > 0 ? shifts : [
                      { name: 'Ca sáng', start: '08:00', end: '12:00' },
                      { name: 'Ca chiều', start: '13:00', end: '17:00' },
                      { name: 'Ca tối', start: '18:00', end: '22:00' },
                    ]).map((s) => (
                      <option key={s.name} value={s.name}>{s.name} ({s.start} – {s.end})</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-split">
                <label>
                  Giờ vào ca thực tế
                  <input type="time" name="checkIn" defaultValue={defaultTimeHHMM} required />
                </label>
                <label>
                  Giờ tan ca (Để trống nếu đang làm)
                  <input type="time" name="checkOut" />
                </label>
              </div>
              <label>
                Nghỉ giữa giờ (Phút)
                <input type="number" name="breakMinutes" min="0" max="240" defaultValue="0" />
              </label>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: 'row' }}>
                  <input type="checkbox" name="isOvernight" /> Ca qua ngày hôm sau
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: 'row' }}>
                  <input type="checkbox" name="isAbsent" /> Đánh dấu Vắng mặt
                </label>
              </div>
              <button className="primary-button" type="submit" disabled={isSubmitting || employees.length === 0}>
                <Icon name="check" /> {isSubmitting ? 'Đang lưu...' : 'Lưu bản ghi chấm công'}
              </button>
            </form>

          ) : modal === 'create-leave' ? (
            <form className="shift-form" onSubmit={handleCreateLeaveRequest}>
              <label>
                Nhân viên xin nghỉ
                <select name="employeeId" defaultValue={employees[0]?.id ?? ''} required>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.code} – {emp.name} ({emp.department})
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-split">
                <label>
                  Loại đơn
                  <select name="type" defaultValue="Nghỉ phép năm">
                    <option value="Nghỉ phép năm">Nghỉ phép năm</option>
                    <option value="Nghỉ việc riêng">Nghỉ việc riêng</option>
                    <option value="Nghỉ ốm">Nghỉ ốm</option>
                    <option value="Đổi ca làm việc">Đổi ca làm việc</option>
                  </select>
                </label>
                <label>
                  Số lượng ngày / ca
                  <input name="daysCount" placeholder="Ví dụ: 1 ngày" defaultValue="1 ngày" required />
                </label>
              </div>
              <div className="form-split">
                <label>
                  Từ ngày (Bắt đầu)
                  <input type="date" name="startDate" defaultValue={todayIso} required />
                </label>
                <label>
                  Đến ngày (Kết thúc)
                  <input type="date" name="endDate" defaultValue={todayIso} required />
                </label>
              </div>
              <label>
                Lý do cụ thể
                <input name="reason" placeholder="Nhập lý do xin nghỉ phép hoặc đổi ca..." required />
              </label>
              <button className="primary-button" type="submit" disabled={isSubmitting || employees.length === 0}>
                <Icon name="plus" /> {isSubmitting ? 'Đang gửi...' : 'Gửi đơn nghỉ phép'}
              </button>
            </form>
          ) : modal === 'search' ? (
            <div className="search-modal">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm trang chức năng hoặc nhân viên…"
                aria-label="Từ khóa tìm kiếm"
              />
              {[...navigation.map((n) => n.label), ...employees.map((e) => e.name)]
                .filter((s) => s.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')))
                .slice(0, 6)
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      const isNav = navigation.some((n) => n.label === s)
                      if (isNav) navigate(s)
                      else {
                        setEmpSearch(s)
                        navigate('Nhân viên')
                      }
                      setModal(null)
                    }}
                  >
                    <Icon name="search" /> {s} <Icon name="arrow" />
                  </button>
                ))}
            </div>
          ) : modal === 'notifications' || modal === 'activity' ? (
            <>
              <p className="modal-description">Nhật ký hoạt động thực tế được ghi nhận từ cơ sở dữ liệu.</p>
              <ActivityFeedList items={realActivities} nowMs={nowMs} />
            </>
          ) : modal === 'logout' ? (
            <>
              <p className="modal-description">Bạn có chắc chắn muốn đăng xuất khỏi không gian làm việc ShiftFlow?</p>
              <form action={logout}>
                <button className="primary-button" type="submit">
                  Về trang đăng nhập <Icon name="arrow" />
                </button>
              </form>
            </>
          ) : modal === 'profile' ? (
            <div className="profile-detail">
              <Avatar initials={computeInitials(userName)} />
              <h3>{userName}</h3>
              <p>{userEmail} · Vai trò: <strong>{isAdmin ? 'Quản trị viên' : 'Nhân viên'}</strong></p>
              <span className="badge success">Bảo mật RLS & Xác thực hợp lệ</span>
            </div>
          ) : (
            <div className="support-content">
              <p>Quản lý đội ngũ của bạn từ một không gian duy nhất.</p>
              <p>
                <strong>Phân công ca:</strong> Vào mục &ldquo;Lịch làm việc&rdquo;, chọn nút &ldquo;+ Phân ca&rdquo; tại đúng ô ngày của nhân viên để lưu phân công thực tế.
              </p>
              <p>
                <strong>Vào ca & Tan ca:</strong> Chọn &ldquo;Vào ca / Chấm công&rdquo; khi bắt đầu làm việc và bấm &ldquo;Tan ca&rdquo; khi kết thúc.
              </p>
            </div>
          )}
        </Modal>
      )}

      {checkoutTarget && (
        <Modal title={`Ghi nhận Tan ca: ${checkoutTarget.name}`} onClose={() => setCheckoutTarget(null)}>
          <form className="shift-form" onSubmit={handleCheckOutSubmit}>
            <p className="modal-description" style={{ margin: '0 0 8px' }}>
              Ca làm: <strong>{checkoutTarget.shift}</strong> · Ngày: <strong>{formatShortDate(checkoutTarget.workDate)}</strong> · Giờ vào ca: <strong>{checkoutTarget.checkIn}</strong>
            </p>
            <div className="form-split">
              <label>
                Giờ tan ca thực tế
                <input type="time" name="checkOut" defaultValue={defaultTimeHHMM} required autoFocus />
              </label>
              <label>
                Nghỉ giữa giờ (Phút)
                <input type="number" name="breakMinutes" min="0" max="240" defaultValue={checkoutTarget.breakMinutes || 0} required />
              </label>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row', fontSize: 13 }}>
              <input type="checkbox" name="isOvernight" /> Ca làm việc qua ngày hôm sau (Qua 00:00)
            </label>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              <Icon name="check" /> {isSubmitting ? 'Đang lưu...' : 'Xác nhận Tan ca & Tính giờ công'}
            </button>
          </form>
        </Modal>
      )}

      {selectedRequest && (
        <Modal title="Chi tiết đơn nghỉ phép" onClose={() => setReview(null)}>
          <div className="review-person">
            <Avatar initials={selectedRequest.initials} tone={selectedRequest.tone} />
            <div>
              <h3>{selectedRequest.name}</h3>
              <p>{selectedRequest.department}</p>
            </div>
          </div>
          <dl className="review-details">
            <div>
              <dt>Loại nghỉ phép</dt>
              <dd>{selectedRequest.type}</dd>
            </div>
            <div>
              <dt>Lý do</dt>
              <dd>{selectedRequest.reason}</dd>
            </div>
            <div>
              <dt>Thời gian</dt>
              <dd>{selectedRequest.date} · {selectedRequest.days}</dd>
            </div>
            <div>
              <dt>Trạng thái hiện tại</dt>
              <dd>{selectedRequest.status}</dd>
            </div>
          </dl>
          {isAdmin && (
            <div className="review-actions">
              {['Từ chối', 'Đã duyệt'].map((status) => (
                <button
                  key={status}
                  className={status === 'Đã duyệt' ? 'primary-button' : 'secondary-button'}
                  disabled={isSubmitting}
                  onClick={() => updateRequestStatus(selectedRequest.id, status)}
                >
                  {status === 'Đã duyệt' ? 'Duyệt đơn' : status}
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}