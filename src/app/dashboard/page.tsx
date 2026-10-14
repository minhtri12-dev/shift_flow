'use client'

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { logout } from '@/actions/auth'
import { createClient } from '@/lib/supabase/client'

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

const sampleAttendance = [
  { day: 'T2', date: '12/10', onTime: 22, late: 1, absent: 1 },
  { day: 'T3', date: '13/10', onTime: 21, late: 2, absent: 1 },
  { day: 'T4', date: '14/10', onTime: 23, late: 1, absent: 0 },
  { day: 'T5', date: '15/10', onTime: 20, late: 2, absent: 2 },
  { day: 'T6', date: '16/10', onTime: 22, late: 1, absent: 1 },
  { day: 'T7', date: '17/10', onTime: 18, late: 1, absent: 1 },
  { day: 'CN', date: '18/10', onTime: 21, late: 1, absent: 2 },
]

type Shift = {
  id?: number
  name: string
  start_time?: string
  end_time?: string
  start?: string
  end?: string
  count: number
  status: string
  icon: IconName
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
}

type Department = {
  id: number
  name: string
  manager: string
  headcount: number
  attendanceRate: number
  activeShifts: string
  tone: string
}

type AttendanceRecord = {
  id: number
  name: string
  initials: string
  department: string
  shift: string
  checkIn: string
  checkOut: string
  totalHours: string
  status: string
  tone: string
}

type LeaveRequest = {
  id: number
  name: string
  initials: string
  department: string
  type: string
  reason: string
  date_range?: string
  date?: string
  days_count?: string
  days?: string
  tone: string
  status: string
}

const initialAttendanceLogs: AttendanceRecord[] = [
  {
    id: 1,
    name: 'Phạm Đức Long',
    initials: 'ĐL',
    department: 'Phòng Vận hành',
    shift: 'Ca sáng',
    checkIn: '07:55',
    checkOut: '12:02',
    totalHours: '4h 07m',
    status: 'Đúng giờ',
    tone: 'peach',
  },
  {
    id: 2,
    name: 'Lê Quốc Bảo Ân',
    initials: 'BA',
    department: 'Phòng Kỹ thuật',
    shift: 'Ca sáng',
    checkIn: '07:58',
    checkOut: '12:00',
    totalHours: '4h 02m',
    status: 'Đúng giờ',
    tone: 'lavender',
  },
  {
    id: 3,
    name: 'Nguyễn Quốc Huy',
    initials: 'QH',
    department: 'Phòng Marketing',
    shift: 'Ca sáng',
    checkIn: '08:17',
    checkOut: '12:10',
    totalHours: '3h 53m',
    status: 'Đi trễ',
    tone: 'peach',
  },
  {
    id: 4,
    name: 'Lê Thu Hà',
    initials: 'TH',
    department: 'Phòng Nhân sự',
    shift: 'Ca chiều',
    checkIn: '12:56',
    checkOut: '17:05',
    totalHours: '4h 09m',
    status: 'Đúng giờ',
    tone: 'mint',
  },
  {
    id: 5,
    name: 'Nguyễn Minh Trí',
    initials: 'MT',
    department: 'Phòng Kỹ thuật',
    shift: 'Ca chiều',
    checkIn: '13:00',
    checkOut: '17:01',
    totalHours: '4h 01m',
    status: 'Đúng giờ',
    tone: 'mint',
  },
  {
    id: 6,
    name: 'Võ Hoàng Yến',
    initials: 'HY',
    department: 'Phòng Kinh doanh',
    shift: 'Ca tối',
    checkIn: '--:--',
    checkOut: '--:--',
    totalHours: '0h 00m',
    status: 'Vắng mặt',
    tone: 'lavender',
  },
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

function ActivityFeed() {
  return (
    <div className="activity-feed">
      {[
        {
          icon: 'check' as IconName,
          tone: 'teal',
          name: 'Phạm Đức Long',
          text: 'vừa chấm công vào ca.',
          time: '5 phút trước',
          detail: 'Ca sáng · 07:55',
        },
        {
          icon: 'file' as IconName,
          tone: 'orange',
          name: 'Nguyễn Quốc Huy',
          text: 'gửi đơn xin nghỉ phép.',
          time: '18 phút trước',
          detail: 'Nghỉ phép năm · 2 ngày',
        },
        {
          icon: 'calendar' as IconName,
          tone: 'blue',
          name: 'Lịch làm việc tuần tới',
          text: 'đã được xuất bản.',
          time: '42 phút trước',
          detail: 'Cập nhật bởi Quản trị viên',
        },
      ].map((a) => (
        <div className="activity-item" key={a.name}>
          <span className={`activity-icon ${a.tone}`}>
            <Icon name={a.icon} />
          </span>
          <div>
            <p>
              <strong>{a.name}</strong> {a.text}
            </p>
            <span>{a.detail}</span>
            <small>{a.time}</small>
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
  const [shifts, setShifts] = useState<Shift[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState(initialAttendanceLogs)
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [review, setReview] = useState<number | null>(null)
  const [period, setPeriod] = useState('week')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [empSearch, setEmpSearch] = useState('')
  const [empDeptFilter, setEmpDeptFilter] = useState('Tất cả')
  const [attFilter, setAttFilter] = useState('Tất cả')
  const [leaveFilter, setLeaveFilter] = useState('Tất cả')
  const [userEmail, setUserEmail] = useState('minhtri@shiftflow.com')
  const [currentDateString, setCurrentDateString] = useState('')

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Hàm tải dữ liệu toàn diện từ Supabase
  const fetchSupabaseData = async () => {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user?.email) {
      setUserEmail(user.email)
    }

    const { data: empData } = await supabase.from('employees').select('*')
    if (empData) setEmployees(empData)

    const { data: deptData } = await supabase.from('departments').select('*')
    if (deptData) setDepartments(deptData)

    const { data: shiftData } = await supabase.from('shifts').select('*')
    if (shiftData) {
      setShifts(
        shiftData.map((s) => ({
          ...s,
          start: s.start_time || s.start || '08:00',
          end: s.end_time || s.end || '12:00',
        })),
      )
    }

    const { data: leaveData } = await supabase.from('leave_requests').select('*')
    if (leaveData) {
      setRequests(
        leaveData.map((r) => ({
          ...r,
          date: r.date_range || r.date || '16/10',
          days: r.days_count || r.days || '1 ngày',
        })),
      )
    }
  }

  // Khởi tạo dữ liệu và Đăng ký Realtime Subscriptions
  useEffect(() => {
    fetchSupabaseData()

    const supabase = createClient()

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees' },
        () => fetchSupabaseData(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'departments' },
        () => fetchSupabaseData(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        () => fetchSupabaseData(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_requests' },
        () => {
          fetchSupabaseData()
          setNotice('Cập nhật trạng thái đơn nghỉ phép thời gian thực!')
        },
      )
      .subscribe()

    const now = new Date()
    const formatted = new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now)
    setCurrentDateString(formatted.charAt(0).toUpperCase() + formatted.slice(1))

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(''), 4000)
    return () => clearTimeout(id)
  }, [notice])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
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

  async function createShift(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const name = String(data.get('name'))
    const start = String(data.get('start'))
    const end = String(data.get('end'))
    const count = Number(data.get('count'))

    if (end <= start) {
      setNotice('Giờ kết thúc phải sau giờ bắt đầu.')
      return
    }

    const supabase = createClient()
    const { error } = await supabase.from('shifts').insert([
      {
        name,
        start_time: start,
        end_time: end,
        count,
        status: 'Sắp bắt đầu',
        icon: 'clock',
      },
    ])

    if (!error) {
      setModal(null)
      setNotice('Đã thêm ca làm việc mới vào Supabase thành công.')
    } else {
      setNotice('Lỗi khi lưu ca làm xuống Supabase.')
    }
  }

  async function handleAddEmployee(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const name = String(data.get('name')).trim()
    const email = String(data.get('email'))
    const role = String(data.get('role'))
    const department = String(data.get('department'))
    const shift = String(data.get('shift'))

    const words = name.split(' ')
    const initials =
      words.length >= 2
        ? `${words[words.length - 2][0]}${words[words.length - 1][0]}`.toUpperCase()
        : name.slice(0, 2).toUpperCase()

    const code = `SF-00${employees.length + 1}`
    const tone = ['peach', 'lavender', 'mint'][employees.length % 3]

    const supabase = createClient()
    const { error } = await supabase.from('employees').insert([
      {
        code,
        name,
        initials,
        email,
        role,
        department,
        shift,
        status: 'Đang hoạt động',
        tone,
      },
    ])

    if (!error) {
      setModal(null)
      setNotice(`Đã thêm nhân viên ${name} vào Supabase thành công.`)
    } else {
      setNotice('Lỗi khi thêm nhân viên.')
    }
  }

  async function handleAddDepartment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const name = String(data.get('name'))
    const manager = String(data.get('manager'))
    const headcount = Number(data.get('headcount'))

    const supabase = createClient()
    const { error } = await supabase.from('departments').insert([
      {
        name,
        manager,
        headcount,
        attendance_rate: 100,
        active_shifts: 'Ca sáng, Ca chiều',
        tone: 'teal',
      },
    ])

    if (!error) {
      setModal(null)
      setNotice(`Đã tạo ${name} thành công trên Supabase.`)
    } else {
      setNotice('Lỗi khi tạo phòng ban.')
    }
  }

  function handleManualCheckIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const name = String(data.get('name'))
    const words = name.split(' ')
    const initials =
      words.length >= 2
        ? `${words[words.length - 2][0]}${words[words.length - 1][0]}`.toUpperCase()
        : 'NV'
    setAttendanceLogs([
      {
        id: Date.now(),
        name,
        initials,
        department: String(data.get('department')),
        shift: String(data.get('shift')),
        checkIn: String(data.get('checkIn')),
        checkOut: '17:00',
        totalHours: '4h 00m',
        status: 'Đúng giờ',
        tone: 'mint',
      },
      ...attendanceLogs,
    ])
    setModal(null)
    setNotice(`Đã ghi nhận chấm công cho ${name}.`)
  }

  async function updateRequestStatus(id: number, status: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('leave_requests')
      .update({ status })
      .eq('id', id)

    if (!error) {
      setRequests(requests.map((r) => (r.id === id ? { ...r, status } : r)))
      setReview(null)
      setNotice(`Đã cập nhật trạng thái đơn: ${status}.`)
    } else {
      setNotice('Lỗi khi cập nhật trạng thái đơn trên Supabase.')
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'Chờ duyệt').length
  const selectedRequest = requests.find((r) => r.id === review)

  const metrics = [
    {
      label: 'Tổng nhân sự',
      value: String(employees.length > 0 ? employees.length : 6),
      description: 'Nhân viên đang hoạt động',
      icon: 'users' as IconName,
      tone: 'teal',
      trend: '+2 trong tháng',
    },
    {
      label: 'Đã chấm công hôm nay',
      value: '22',
      description: '91,7% tổng nhân sự',
      icon: 'check' as IconName,
      tone: 'blue',
      trend: 'Đang hoạt động',
    },
    {
      label: 'Đi trễ / Vắng mặt',
      value: '2',
      description: 'Cần kiểm tra',
      icon: 'clock' as IconName,
      tone: 'orange',
      trend: '1 đi trễ · 1 vắng mặt',
    },
    {
      label: 'Đơn chờ duyệt',
      value: String(pendingCount),
      description: 'Đang chờ xử lý',
      icon: 'file' as IconName,
      tone: 'purple',
      trend: `${pendingCount} đơn cần xem xét`,
    },
  ]

  const filteredEmployees = employees.filter((emp) => {
    const matchDept =
      empDeptFilter === 'Tất cả' || emp.department === empDeptFilter
    const matchQuery =
      emp.name.toLowerCase().includes(empSearch.toLowerCase()) ||
      emp.email.toLowerCase().includes(empSearch.toLowerCase()) ||
      emp.role.toLowerCase().includes(empSearch.toLowerCase())
    return matchDept && matchQuery
  })

  const filteredAttendance = attendanceLogs.filter(
    (log) => attFilter === 'Tất cả' || log.status === attFilter,
  )

  const filteredLeaves = requests.filter(
    (req) => leaveFilter === 'Tất cả' || req.status === leaveFilter,
  )

  return (
    <div className="dashboard">
      {drawer && (
        <button
          className="drawer-overlay"
          aria-label="Đóng điều hướng"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside
        className={`sidebar ${drawer ? 'is-open' : ''}`}
        aria-label="Điều hướng chính"
      >
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
          <button
            className={`nav-item ${active === 'Cài đặt' ? 'active' : ''}`}
            onClick={() => navigate('Cài đặt')}
          >
            <Icon name="settings" />
            <span>Cài đặt</span>
          </button>
          <div className="sidebar-profile">
            <Avatar initials="MT" />
            <div>
              <strong>Nguyễn Minh Trí</strong>
              <span>{userEmail}</span>
            </div>
            <button
              className="icon-button"
              aria-label="Đăng xuất"
              title="Đăng xuất"
              onClick={() => setModal('logout')}
            >
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
            <span className="breadcrumb-home">Không gian làm việc</span>
            <Icon name="chevron" />
            <strong>{active}</strong>
          </div>
          <div className="topbar-right">
            <span className="header-date">
              <Icon name="calendar" />
              {currentDateString || 'Đang tải ngày...'}
            </span>
            <span className="header-divider" />
            <button
              className="icon-button"
              aria-label="Tìm kiếm"
              onClick={() => setModal('search')}
            >
              <Icon name="search" />
            </button>
            <button
              className="icon-button notification-button"
              aria-label="Thông báo mới"
              onClick={() => setModal('notifications')}
            >
              <Icon name="bell" />
              <i />
            </button>
            <span className="header-divider" />
            <button className="header-user" onClick={() => setModal('profile')}>
              <Avatar initials="MT" />
              <span>Minh Trí</span>
              <Icon name="chevron" />
            </button>
          </div>
        </header>

        <main className="dashboard-content">
          <div className="page-heading">
            <div>
              <div className="page-eyebrow">
                <span /> KHÔNG GIAN QUẢN TRỊ (REALTIME DATABASE CONNECTED)
              </div>
              <h1>{active}</h1>
              <p>
                {active === 'Tổng quan' &&
                  'Theo dõi tình hình nhân sự và hoạt động trong ngày.'}
                {active === 'Nhân viên' &&
                  'Quản lý hồ sơ, vai trò và phân bổ nhân sự theo từng phòng ban.'}
                {active === 'Phòng ban' &&
                  'Cơ cấu tổ chức, trưởng bộ phận và hiệu suất chuyên cần.'}
                {active === 'Lịch làm việc' &&
                  'Tối ưu hóa ca làm việc và phân công lịch trực trong tuần.'}
                {active === 'Chấm công' &&
                  'Theo dõi giờ vào ca, tan ca và trạng thái chuyên cần thực tế.'}
                {active === 'Đơn nghỉ phép' &&
                  'Xét duyệt nhanh các yêu cầu nghỉ phép và đổi ca của nhân viên.'}
                {active === 'Báo cáo' &&
                  'Phân tích chuyên sâu dữ liệu chấm công, giờ làm và tỷ lệ đúng giờ.'}
                {active === 'Cài đặt' &&
                  'Thiết lập quy tắc ca làm, múi giờ và thông báo cho hệ thống.'}
              </p>
            </div>
            <div className="heading-actions">
              {active === 'Nhân viên' ? (
                <button
                  className="primary-button"
                  onClick={() => setModal('add-employee')}
                >
                  <Icon name="plus" />
                  Thêm nhân viên
                </button>
              ) : active === 'Phòng ban' ? (
                <button
                  className="primary-button"
                  onClick={() => setModal('add-department')}
                >
                  <Icon name="plus" />
                  Thêm phòng ban
                </button>
              ) : active === 'Chấm công' ? (
                <button
                  className="primary-button"
                  onClick={() => setModal('manual-checkin')}
                >
                  <Icon name="plus" />
                  Chấm công thủ công
                </button>
              ) : active === 'Báo cáo' ? (
                <button
                  className="primary-button"
                  onClick={() =>
                    setNotice('Đã xuất tệp báo cáo ShiftFlow_Report_10_2026.csv')
                  }
                >
                  <Icon name="download" />
                  Xuất báo cáo CSV
                </button>
              ) : (
                <>
                  <span className="demo-indicator">Cloud DB Sync</span>
                  <button
                    className="primary-button"
                    onClick={() => setModal('create')}
                  >
                    <Icon name="plus" />
                    Tạo ca làm
                  </button>
                </>
              )}
            </div>
          </div>

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
                    <strong className="metric-value">{metric.value}</strong>
                    <p>{metric.description}</p>
                    <div className={`metric-foot ${metric.tone}`}>
                      {metric.tone === 'teal' ? (
                        <span className="trend-arrow">↗</span>
                      ) : (
                        <span className="tiny-dot" />
                      )}
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
                      period === 'week'
                        ? 'Thống kê trong 7 ngày gần nhất'
                        : 'Thống kê 7 ngày trước đó'
                    }
                    action={
                      <div className="custom-dropdown" ref={dropdownRef}>
                        <button
                          type="button"
                          className={`dropdown-trigger ${
                            dropdownOpen ? 'is-open' : ''
                          }`}
                          onClick={() => setDropdownOpen((o) => !o)}
                          aria-expanded={dropdownOpen}
                        >
                          <Icon name="calendar" />
                          <span>
                            {
                              periodOptions.find((o) => o.value === period)
                                ?.label
                            }
                          </span>
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
                                className={`dropdown-item ${
                                  period === opt.value ? 'selected' : ''
                                }`}
                                onClick={() => {
                                  setPeriod(opt.value)
                                  setDropdownOpen(false)
                                }}
                              >
                                <span>{opt.label}</span>
                                {period === opt.value && (
                                  <Icon name="tick" className="check-mark" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    }
                  />
                  <div className="chart-legend">
                    <span>
                      <i className="legend-teal" />
                      Đúng giờ
                    </span>
                    <span>
                      <i className="legend-amber" />
                      Đi trễ
                    </span>
                    <span>
                      <i className="legend-gray" />
                      Vắng mặt
                    </span>
                  </div>
                  <div className="chart-container">
                    <div className="chart-y-axis">
                      {[24, 18, 12, 6, 0].map((n) => (
                        <span key={n}>{n}</span>
                      ))}
                    </div>
                    <div className="chart-plot">
                      <div className="chart-gridlines">
                        {[0, 1, 2, 3, 4].map((n) => (
                          <i key={n} />
                        ))}
                      </div>
                      <div className="chart-bars">
                        {sampleAttendance.map((day, i) => {
                          const onTime =
                            period === 'week'
                              ? day.onTime
                              : day.onTime - (i % 3)
                          return (
                            <div
                              className={`bar-column ${i === 2 ? 'today' : ''}`}
                              key={day.day}
                            >
                              <div
                                className="bar-track"
                                tabIndex={0}
                                aria-label={`${day.day}: ${onTime} đúng giờ, ${day.late} đi trễ, ${day.absent} vắng mặt`}
                              >
                                <div className="bar-stack">
                                  <div
                                    className="bar-absent"
                                    style={{
                                      height: `${(day.absent / 24) * 100}%`,
                                    }}
                                  />
                                  <div
                                    className="bar-late"
                                    style={{
                                      height: `${(day.late / 24) * 100}%`,
                                    }}
                                  />
                                  <div
                                    className="bar-ontime"
                                    style={{
                                      height: `${(onTime / 24) * 100}%`,
                                    }}
                                  />
                                </div>
                                <span className="chart-tooltip">
                                  {onTime} đúng giờ · {day.late} trễ ·{' '}
                                  {day.absent} vắng
                                </span>
                              </div>
                              <span className="bar-label">
                                {day.day}
                                <small>
                                  {period === 'week'
                                    ? day.date
                                    : `${String(i + 10).padStart(2, '0')}/10`}
                                </small>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="chart-footer">
                    <span>
                      <span className="tiny-dot" />
                      Tỷ lệ đúng giờ trung bình
                    </span>
                    <strong>
                      {period === 'week' ? '87,5%' : '83,3%'}
                      <span> trong kỳ</span>
                    </strong>
                  </div>
                </section>

                <section className="panel schedule-panel">
                  <PanelHeading
                    title="Lịch làm việc hôm nay"
                    subtitle="Ca làm và tình trạng nhân sự"
                    action={
                      <span className="count-label">
                        {shifts.length} ca làm
                      </span>
                    }
                  />
                  <div className="shift-list">
                    {shifts.slice(0, 3).map((shift, i) => (
                      <div
                        className={`shift-item ${i === 0 ? 'ongoing' : ''}`}
                        key={`${shift.name}-${i}`}
                      >
                        <span className="shift-icon">
                          <Icon name={shift.icon} />
                        </span>
                        <div className="shift-details">
                          <div className="shift-title">
                            <h3>{shift.name}</h3>
                            <span
                              className={`badge ${
                                i === 0 ? 'success' : 'neutral'
                              }`}
                            >
                              {shift.status}
                            </span>
                          </div>
                          <p>
                            <Icon name="clock" />
                            {shift.start} – {shift.end}
                          </p>
                          <div className="shift-employees">
                            <div className="avatar-stack">
                              <Avatar initials="QH" tone="peach" />
                              <Avatar initials="BA" tone="lavender" />
                              <Avatar initials="MT" tone="mint" />
                            </div>
                            <span>{shift.count} nhân viên</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="panel-bottom-link"
                    onClick={() => navigate('Lịch làm việc')}
                  >
                    Xem lịch làm việc
                    <Icon name="arrow" />
                  </button>
                </section>
              </div>

              <div className="content-grid lower-grid">
                <section className="panel leave-panel">
                  <PanelHeading
                    title="Đơn nghỉ phép chờ duyệt"
                    action={
                      <button
                        className="text-button"
                        onClick={() => navigate('Đơn nghỉ phép')}
                      >
                        Xem tất cả
                        <Icon name="arrow" />
                      </button>
                    }
                  />
                  <div className="request-table">
                    <div className="request-table-head">
                      <span>NHÂN VIÊN</span>
                      <span>THỜI GIAN NGHỈ</span>
                      <span>TRẠNG THÁI</span>
                      <span />
                    </div>
                    {requests.slice(0, 3).map((r) => (
                      <button
                        className="request-row"
                        key={r.id}
                        onClick={() => setReview(r.id)}
                      >
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
                        <span
                          className={`badge ${
                            r.status === 'Đã duyệt'
                              ? 'success'
                              : r.status === 'Từ chối'
                                ? 'danger'
                                : 'warning'
                          }`}
                        >
                          {r.status}
                        </span>
                        <Icon name="chevron" />
                      </button>
                    ))}
                  </div>
                  <div className="table-note">
                    <Icon name="file" />
                    Bạn có {pendingCount} đơn nghỉ phép đang chờ phê duyệt.
                  </div>
                </section>

                <section className="panel activity-panel">
                  <PanelHeading
                    title="Hoạt động gần đây"
                    action={
                      <button
                        className="text-button"
                        onClick={() => setModal('activity')}
                      >
                        Xem tất cả
                        <Icon name="arrow" />
                      </button>
                    }
                  />
                  <ActivityFeed />
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
                    placeholder="Tìm theo tên, email hoặc chức vụ..."
                  />
                </div>
                <div className="filter-pills">
                  {[
                    'Tất cả',
                    'Phòng Kỹ thuật',
                    'Phòng Marketing',
                    'Phòng Nhân sự',
                    'Phòng Vận hành',
                    'Phòng Kinh doanh',
                  ].map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      className={`pill-btn ${
                        empDeptFilter === dept ? 'active' : ''
                      }`}
                      onClick={() => setEmpDeptFilter(dept)}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>
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
                        <td>
                          <strong>{emp.code}</strong>
                        </td>
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
                          <span
                            className={`badge ${
                              emp.status === 'Đang hoạt động'
                                ? 'success'
                                : 'warning'
                            }`}
                          >
                            {emp.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {active === 'Phòng ban' && (
            <div className="dept-grid">
              {departments.map((d) => (
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
                      <span>Tỷ lệ chuyên cần</span>
                      <strong>{d.attendanceRate}%</strong>
                    </div>
                    <div className="dept-progress-bar">
                      <div
                        className="dept-progress-fill"
                        style={{ width: `${d.attendanceRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="dept-footer">
                    <span>
                      <strong>{d.headcount}</strong> nhân sự
                    </span>
                    <span>{d.activeShifts}</span>
                  </div>
                </article>
              ))}
            </div>
          )}

          {active === 'Lịch làm việc' && (
            <>
              <div className="schedule-cards-row">
                {shifts.map((s, idx) => (
                  <article className="dept-card" key={`${s.name}-${idx}`}>
                    <div className="dept-head">
                      <div>
                        <h3>{s.name}</h3>
                        <p>
                          Khung giờ: {s.start} – {s.end}
                        </p>
                      </div>
                      <span className="metric-icon teal">
                        <Icon name={s.icon} />
                      </span>
                    </div>
                    <div className="dept-footer">
                      <span>
                        <strong>{s.count}</strong> nhân viên được phân ca
                      </span>
                      <span
                        className={`badge ${
                          s.status === 'Đang diễn ra' ? 'success' : 'neutral'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                  </article>
                ))}
              </div>

              <section className="panel">
                <PanelHeading
                  title="Bảng phân ca trong tuần (12/10 – 18/10)"
                  subtitle="Lịch trực cố định theo từng nhân sự chủ chốt"
                />
                <div className="data-table-wrap" style={{ marginTop: 14 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nhân viên</th>
                        <th>Phòng ban</th>
                        <th>Thứ 2</th>
                        <th>Thứ 3</th>
                        <th>Thứ 4</th>
                        <th>Thứ 5</th>
                        <th>Thứ 6</th>
                        <th>Thứ 7</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => (
                        <tr key={emp.id}>
                          <td>
                            <div className="employee-cell">
                              <Avatar initials={emp.initials} tone={emp.tone} />
                              <strong>{emp.name}</strong>
                            </div>
                          </td>
                          <td>{emp.department}</td>
                          <td>
                            <span className="badge success">{emp.shift}</span>
                          </td>
                          <td>
                            <span className="badge success">{emp.shift}</span>
                          </td>
                          <td>
                            <span className="badge success">{emp.shift}</span>
                          </td>
                          <td>
                            <span className="badge success">{emp.shift}</span>
                          </td>
                          <td>
                            <span className="badge success">{emp.shift}</span>
                          </td>
                          <td>
                            <span className="badge neutral">Nghỉ tuần</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {active === 'Chấm công' && (
            <section className="panel">
              <div className="module-toolbar">
                <div>
                  <strong>Nhật ký chấm công hôm nay</strong>
                </div>
                <div className="filter-pills">
                  {['Tất cả', 'Đúng giờ', 'Đi trễ', 'Vắng mặt'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`pill-btn ${attFilter === st ? 'active' : ''}`}
                      onClick={() => setAttFilter(st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nhân viên</th>
                      <th>Phòng ban</th>
                      <th>Ca làm việc</th>
                      <th>Giờ vào</th>
                      <th>Giờ ra</th>
                      <th>Tổng thời gian</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendance.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <div className="employee-cell">
                            <Avatar initials={log.initials} tone={log.tone} />
                            <strong>{log.name}</strong>
                          </div>
                        </td>
                        <td>{log.department}</td>
                        <td>{log.shift}</td>
                        <td>
                          <strong>{log.checkIn}</strong>
                        </td>
                        <td>{log.checkOut}</td>
                        <td>{log.totalHours}</td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {active === 'Đơn nghỉ phép' && (
            <section className="panel">
              <div className="module-toolbar">
                <div className="filter-pills">
                  {['Tất cả', 'Chờ duyệt', 'Đã duyệt', 'Từ chối'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`pill-btn ${
                        leaveFilter === st ? 'active' : ''
                      }`}
                      onClick={() => setLeaveFilter(st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nhân viên</th>
                      <th>Loại đơn</th>
                      <th>Lý do</th>
                      <th>Thời gian</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeaves.map((req) => (
                      <tr key={req.id}>
                        <td>
                          <div className="employee-cell">
                            <Avatar initials={req.initials} tone={req.tone} />
                            <span>
                              <strong>{req.name}</strong>
                              <small>{req.department}</small>
                            </span>
                          </div>
                        </td>
                        <td>{req.type}</td>
                        <td>{req.reason}</td>
                        <td>
                          <strong>{req.date}</strong> ({req.days})
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              req.status === 'Đã duyệt'
                                ? 'success'
                                : req.status === 'Từ chối'
                                  ? 'danger'
                                  : 'warning'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td>
                          <div className="action-group">
                            <button
                              type="button"
                              className="mini-btn approve"
                              onClick={() =>
                                updateRequestStatus(req.id, 'Đã duyệt')
                              }
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              className="mini-btn reject"
                              onClick={() =>
                                updateRequestStatus(req.id, 'Từ chối')
                              }
                            >
                              Từ chối
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {active === 'Báo cáo' && (
            <>
              <section className="metrics-grid">
                <article className="metric-card">
                  <div className="metric-top">
                    <span>Tổng giờ công tháng 10</span>
                    <span className="metric-icon teal">
                      <Icon name="clock" />
                    </span>
                  </div>
                  <strong className="metric-value">1.840h</strong>
                  <p>Đạt 98,2% kế hoạch tháng</p>
                  <div className="metric-foot teal">
                    <span className="trend-arrow">↗</span> +4,5% so với tháng trước
                  </div>
                </article>
                <article className="metric-card">
                  <div className="metric-top">
                    <span>Tỷ lệ đúng giờ toàn công ty</span>
                    <span className="metric-icon blue">
                      <Icon name="check" />
                    </span>
                  </div>
                  <strong className="metric-value">92,4%</strong>
                  <p>Vượt mục tiêu KPI (90%)</p>
                  <div className="metric-foot blue">
                    <span className="tiny-dot" /> Duy trì ổn định
                  </div>
                </article>
                <article className="metric-card">
                  <div className="metric-top">
                    <span>Số giờ tăng ca (OT)</span>
                    <span className="metric-icon orange">
                      <Icon name="sun" />
                    </span>
                  </div>
                  <strong className="metric-value">64h</strong>
                  <p>Tập trung ở Phòng Kỹ thuật</p>
                  <div className="metric-foot orange">
                    <span className="tiny-dot" /> Trong hạn mức ngân sách
                  </div>
                </article>
                <article className="metric-card">
                  <div className="metric-top">
                    <span>Tỷ lệ sử dụng phép năm</span>
                    <span className="metric-icon purple">
                      <Icon name="file" />
                    </span>
                  </div>
                  <strong className="metric-value">38%</strong>
                  <p>Trung bình 4,5 ngày/nhân sự</p>
                  <div className="metric-foot purple">
                    <span className="tiny-dot" /> Cân đối giữa các phòng
                  </div>
                </article>
              </section>

              <section className="panel" style={{ paddingBottom: 22 }}>
                <PanelHeading
                  title="So sánh tỷ lệ chuyên cần theo phòng ban"
                  subtitle="Dữ liệu tổng hợp theo thời gian thực"
                />
                <div
                  style={{
                    padding: '20px 22px 0',
                    display: 'grid',
                    gap: 16,
                  }}
                >
                  {departments.map((d) => (
                    <div className="dept-progress-wrap" key={d.id}>
                      <div className="dept-progress-label">
                        <strong>
                          {d.name} ({d.headcount} nhân sự)
                        </strong>
                        <strong>{d.attendanceRate}% đúng giờ</strong>
                      </div>
                      <div className="dept-progress-bar">
                        <div
                          className="dept-progress-fill"
                          style={{ width: `${d.attendanceRate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {active === 'Cài đặt' && (
            <div className="settings-grid">
              <section className="panel">
                <PanelHeading
                  title="Cấu hình không gian làm việc"
                  subtitle="Thông tin chung và quy định chấm công tiêu chuẩn"
                />
                <form
                  className="settings-body"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setNotice('Đã lưu cấu hình hệ thống ShiftFlow thành công.')
                  }}
                >
                  <div className="settings-field">
                    <label>Tên không gian làm việc</label>
                    <input defaultValue="ShiftFlow Enterprise Workspace" />
                  </div>
                  <div className="settings-field">
                    <label>Múi giờ hệ thống</label>
                    <input defaultValue="Asia/Ho_Chi_Minh (GMT+7)" />
                  </div>
                  <div className="settings-field">
                    <label>Thời gian cho phép trễ tối đa (Phút)</label>
                    <input type="number" defaultValue="10" />
                  </div>
                  <div>
                    <button type="submit" className="primary-button">
                      Lưu thay đổi
                    </button>
                  </div>
                </form>
              </section>

              <section className="panel">
                <PanelHeading
                  title="Tùy chọn thông báo & Tự động hóa"
                  subtitle="Kiểm soát cảnh báo gửi về cho Quản trị viên"
                />
                <div className="settings-body">
                  <div className="toggle-row">
                    <div>
                      <strong>Thông báo qua Email khi có đơn nghỉ phép</strong>
                      <span>
                        Gửi email tức thì cho Quản trị viên khi nhân viên nộp đơn
                      </span>
                    </div>
                    <button
                      type="button"
                      className="switch-btn on"
                      onClick={(e) => e.currentTarget.classList.toggle('on')}
                    >
                      <i />
                    </button>
                  </div>
                  <div className="toggle-row">
                    <div>
                      <strong>Cảnh báo nhân sự đi trễ quá hạn mức</strong>
                      <span>Hiển thị cảnh báo nổi bật nếu trễ quá 10 phút</span>
                    </div>
                    <button
                      type="button"
                      className="switch-btn on"
                      onClick={(e) => e.currentTarget.classList.toggle('on')}
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
              <span className="tiny-dot" />
              Không gian làm việc của bạn, vận hành tốt hơn.
            </span>
          </footer>
        </main>
      </div>

      {notice && (
        <div className="toast" role="status">
          <Icon name="check" />
          {notice}
          <button
            className="icon-button"
            aria-label="Đóng"
            onClick={() => setNotice('')}
          >
            <Icon name="close" />
          </button>
        </div>
      )}

      {modal && (
        <Modal
          title={
            (
              {
                create: 'Tạo ca làm mới',
                'add-employee': 'Thêm nhân viên mới',
                'add-department': 'Thêm phòng ban mới',
                'manual-checkin': 'Ghi nhận chấm công thủ công',
                notifications: 'Thông báo hệ thống',
                search: 'Tìm kiếm nhanh trong ShiftFlow',
                profile: 'Thông tin tài khoản',
                logout: 'Xác nhận đăng xuất',
                support: 'Trung tâm trợ giúp',
                activity: 'Hoạt động gần đây',
              } as Record<string, string>
            )[modal]
          }
          onClose={() => setModal(null)}
        >
          {modal === 'create' ? (
            <form className="shift-form" onSubmit={createShift}>
              <label>
                Tên ca làm
                <input
                  name="name"
                  placeholder="Ví dụ: Ca gãy tăng cường"
                  required
                  maxLength={50}
                  autoFocus
                />
              </label>
              <div className="form-split">
                <label>
                  Giờ bắt đầu
                  <input
                    type="time"
                    name="start"
                    defaultValue="08:00"
                    required
                  />
                </label>
                <label>
                  Giờ kết thúc
                  <input type="time" name="end" defaultValue="12:00" required />
                </label>
              </div>
              <label>
                Số nhân viên được phân công
                <input
                  type="number"
                  name="count"
                  min="1"
                  max="50"
                  defaultValue="6"
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                <Icon name="plus" />
                Lưu ca làm
              </button>
            </form>
          ) : modal === 'add-employee' ? (
            <form className="shift-form" onSubmit={handleAddEmployee}>
              <label>
                Họ và tên nhân viên
                <input
                  name="name"
                  placeholder="Ví dụ: Nguyễn Văn An"
                  required
                  autoFocus
                />
              </label>
              <label>
                Email công việc
                <input
                  type="email"
                  name="email"
                  placeholder="an.nguyen@shiftflow.com"
                  required
                />
              </label>
              <div className="form-split">
                <label>
                  Chức vụ
                  <input name="role" placeholder="Chuyên viên..." required />
                </label>
                <label>
                  Phòng ban
                  <select name="department" defaultValue="Phòng Kỹ thuật">
                    <option value="Phòng Kỹ thuật">Phòng Kỹ thuật</option>
                    <option value="Phòng Marketing">Phòng Marketing</option>
                    <option value="Phòng Nhân sự">Phòng Nhân sự</option>
                    <option value="Phòng Vận hành">Phòng Vận hành</option>
                    <option value="Phòng Kinh doanh">Phòng Kinh doanh</option>
                  </select>
                </label>
              </div>
              <label>
                Ca làm việc mặc định
                <select name="shift" defaultValue="Ca sáng">
                  <option value="Ca sáng">Ca sáng (08:00 – 12:00)</option>
                  <option value="Ca chiều">Ca chiều (13:00 – 17:00)</option>
                  <option value="Ca tối">Ca tối (18:00 – 22:00)</option>
                </select>
              </label>
              <button className="primary-button" type="submit">
                <Icon name="plus" />
                Thêm vào danh sách
              </button>
            </form>
          ) : modal === 'add-department' ? (
            <form className="shift-form" onSubmit={handleAddDepartment}>
              <label>
                Tên phòng ban
                <input
                  name="name"
                  placeholder="Ví dụ: Phòng Chăm sóc Khách hàng"
                  required
                  autoFocus
                />
              </label>
              <div className="form-split">
                <label>
                  Trưởng bộ phận
                  <input name="manager" placeholder="Họ tên quản lý" required />
                </label>
                <label>
                  Số lượng nhân sự
                  <input
                    type="number"
                    name="headcount"
                    defaultValue="4"
                    min="1"
                    required
                  />
                </label>
              </div>
              <button className="primary-button" type="submit">
                <Icon name="plus" />
                Tạo phòng ban
              </button>
            </form>
          ) : modal === 'manual-checkin' ? (
            <form className="shift-form" onSubmit={handleManualCheckIn}>
              <label>
                Tên nhân viên
                <input
                  name="name"
                  placeholder="Nhập họ tên nhân viên"
                  required
                  autoFocus
                />
              </label>
              <div className="form-split">
                <label>
                  Phòng ban
                  <select name="department" defaultValue="Phòng Kỹ thuật">
                    <option value="Phòng Kỹ thuật">Phòng Kỹ thuật</option>
                    <option value="Phòng Marketing">Phòng Marketing</option>
                    <option value="Phòng Vận hành">Phòng Vận hành</option>
                  </select>
                </label>
                <label>
                  Ca làm
                  <select name="shift" defaultValue="Ca sáng">
                    <option value="Ca sáng">Ca sáng</option>
                    <option value="Ca chiều">Ca chiều</option>
                    <option value="Ca tối">Ca tối</option>
                  </select>
                </label>
              </div>
              <label>
                Giờ vào thực tế
                <input type="time" name="checkIn" defaultValue="07:55" required />
              </label>
              <button className="primary-button" type="submit">
                <Icon name="check" />
                Xác nhận chấm công
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
              {[
                ...navigation.map((n) => n.label),
                ...employees.map((e) => e.name),
              ]
                .filter((s) =>
                  s
                    .toLocaleLowerCase('vi')
                    .includes(query.toLocaleLowerCase('vi')),
                )
                .slice(0, 6)
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      navigate(
                        navigation.some((n) => n.label === s) ? s : 'Nhân viên',
                      )
                      setModal(null)
                    }}
                  >
                    <Icon name="search" />
                    {s}
                    <Icon name="arrow" />
                  </button>
                ))}
            </div>
          ) : modal === 'notifications' || modal === 'activity' ? (
            <>
              <p className="modal-description">
                Nhật ký hoạt động theo thời gian thực trong không gian làm việc.
              </p>
              <ActivityFeed />
            </>
          ) : modal === 'logout' ? (
            <>
              <p className="modal-description">
                Bạn có chắc chắn muốn đăng xuất khỏi không gian làm việc
                ShiftFlow?
              </p>
              <form action={logout}>
                <button className="primary-button" type="submit">
                  Về trang đăng nhập
                  <Icon name="arrow" />
                </button>
              </form>
            </>
          ) : modal === 'profile' ? (
            <div className="profile-detail">
              <Avatar initials="MT" />
              <h3>Nguyễn Minh Trí</h3>
              <p>{userEmail} · ShiftFlow Workspace</p>
              <span className="badge success">Phiên xác thực hợp lệ (Full Cloud DB)</span>
            </div>
          ) : (
            <div className="support-content">
              <p>Quản lý đội ngũ của bạn từ một không gian duy nhất.</p>
              <p>
                <strong>Tạo ca làm:</strong> chọn “Tạo ca làm”, điền thời gian
                và số nhân viên.
              </p>
              <p>
                <strong>Duyệt nghỉ phép:</strong> chọn một đơn để xem chi tiết
                hoặc bấm Duyệt trực tiếp tại bảng Đơn nghỉ phép.
              </p>
            </div>
          )}
        </Modal>
      )}

      {selectedRequest && (
        <Modal title="Chi tiết đơn nghỉ phép" onClose={() => setReview(null)}>
          <div className="review-person">
            <Avatar
              initials={selectedRequest.initials}
              tone={selectedRequest.tone}
            />
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
              <dd>
                {selectedRequest.date} · {selectedRequest.days}
              </dd>
            </div>
            <div>
              <dt>Trạng thái hiện tại</dt>
              <dd>{selectedRequest.status}</dd>
            </div>
          </dl>
          <div className="review-actions">
            {['Từ chối', 'Đã duyệt'].map((status) => (
              <button
                key={status}
                className={
                  status === 'Đã duyệt' ? 'primary-button' : 'secondary-button'
                }
                onClick={() => updateRequestStatus(selectedRequest.id, status)}
              >
                {status === 'Đã duyệt' ? 'Duyệt đơn' : status}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}