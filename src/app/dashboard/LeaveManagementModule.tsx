'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getLeaveInterval } from '@/lib/scheduleValidation'
import type {
  ScheduleEmployeeItem,
  ShiftAssignment,
} from './WeeklyScheduleModule'

export type LeaveItem = {
  id: number
  employeeId?: number | null
  name: string
  initials: string
  department: string
  type: string
  reason: string
  date: string
  days: string
  dateRange?: string
  daysCount?: string
  tone: string
  status: string
  createdAt?: string
  updatedAt?: string
}

type LeaveManagementProps = {
  requests: LeaveItem[]
  employees: ScheduleEmployeeItem[]
  departments: string[]
  assignments: ShiftAssignment[]
  todayIso: string
  isLoading: boolean
  isAdmin: boolean
  onRefresh: () => Promise<void>
  onNotify: (msg: string) => void
}

function formatShortDate(isoDate: string): string {
  if (!isoDate) return '--/--'
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  return `${parts[2]}/${parts[1]}`
}

export default function LeaveManagementModule({
  requests,
  employees,
  departments,
  assignments,
  todayIso,
  isLoading,
  isAdmin,
  onRefresh,
  onNotify,
}: LeaveManagementProps) {
  const [statusFilter, setStatusFilter] = useState<string>('Tất cả')
  const [typeFilter, setTypeFilter] = useState<string>('Tất cả')
  const [deptFilter, setDeptFilter] = useState<string>('Tất cả')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false)
  const [selectedEmpId, setSelectedEmpId] = useState<string>('')
  const [leaveType, setLeaveType] = useState<string>('Nghỉ phép năm')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [daysCountText, setDaysCountText] = useState<string>('1 ngày')
  const [reasonText, setReasonText] = useState<string>('')

  const [reviewTarget, setReviewTarget] = useState<LeaveItem | null>(null)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [modalError, setModalError] = useState<string>('')

  const createDialogRef = useRef<HTMLDialogElement>(null)
  const reviewDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (todayIso) {
      if (!startDate) setStartDate(todayIso)
      if (!endDate) setEndDate(todayIso)
    }
  }, [todayIso, startDate, endDate])

  useEffect(() => {
    if (isCreateModalOpen && createDialogRef.current && !createDialogRef.current.open) {
      setModalError('')
      createDialogRef.current.showModal()
    }
  }, [isCreateModalOpen])

  useEffect(() => {
    if (reviewTarget && reviewDialogRef.current && !reviewDialogRef.current.open) {
      setModalError('')
      reviewDialogRef.current.showModal()
    }
  }, [reviewTarget])

  const employeeMap = useMemo(() => {
    const map = new Map<number, ScheduleEmployeeItem>()
    for (const e of employees) map.set(e.id, e)
    return map
  }, [employees])

  const leaveMetrics = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'Chờ duyệt').length
    const approved = requests.filter((r) => r.status === 'Đã duyệt').length
    const rejected = requests.filter((r) => r.status === 'Từ chối').length
    return { total: requests.length, pending, approved, rejected }
  }, [requests])

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== 'Tất cả' && r.status !== statusFilter) return false
      if (typeFilter !== 'Tất cả' && r.type !== typeFilter) return false
      if (deptFilter !== 'Tất cả' && r.department !== deptFilter) return false

      const q = searchQuery.trim().toLowerCase()
      if (q) {
        const mName = r.name.toLowerCase().includes(q)
        const mDept = r.department.toLowerCase().includes(q)
        const mType = r.type.toLowerCase().includes(q)
        const mReason = r.reason.toLowerCase().includes(q)
        if (!mName && !mDept && !mType && !mReason) return false
      }
      return true
    })
  }, [requests, statusFilter, typeFilter, deptFilter, searchQuery])

  function handleOpenCreateModal() {
    const activeEmps = employees.filter((e) => e.status === 'Đang hoạt động')
    if (activeEmps.length === 0) {
      onNotify('Chưa có nhân viên nào đang hoạt động.')
      return
    }
    setSelectedEmpId(String(activeEmps[0].id))
    setLeaveType('Nghỉ phép năm')
    if (todayIso) {
      setStartDate(todayIso)
      setEndDate(todayIso)
    }
    setDaysCountText('1 ngày')
    setReasonText('')
    setIsCreateModalOpen(true)
  }

  function getEmployeeShiftConflictsForLeave(empId: number, rangeStr: string): ShiftAssignment[] {
    const mockLeave: LeaveItem = {
      id: 0,
      employeeId: empId,
      name: '',
      initials: '',
      department: '',
      type: '',
      reason: '',
      date: rangeStr,
      days: '',
      dateRange: rangeStr,
      tone: '',
      status: 'Đã duyệt',
    }
    const interval = getLeaveInterval(mockLeave)
    if (!interval) return []

    return assignments.filter((a) => {
      if (a.employeeId !== empId || a.status === 'Đã hủy') return false
      const parts = a.workDate.split('-').map(Number)
      if (parts.length !== 3) return false
      const dayStartMins = Date.UTC(parts[0], parts[1] - 1, parts[2]) / 60000
      const leaveStartDay = Math.floor(interval.startMinutes / (24 * 60)) * 24 * 60
      const leaveEndDay = Math.floor(interval.endMinutes / (24 * 60)) * 24 * 60
      return dayStartMins >= leaveStartDay && dayStartMins <= leaveEndDay
    })
  }

  async function handleCreateLeaveSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const empIdNum = Number(selectedEmpId)
    const emp = employeeMap.get(empIdNum)

    if (!emp || !startDate || !reasonText.trim()) {
      setModalError('Vui lòng điền đầy đủ thông tin nhân viên, ngày bắt đầu và lý do xin nghỉ.')
      return
    }

    if (endDate && endDate < startDate) {
      setModalError('Ngày kết thúc không được trước ngày bắt đầu.')
      return
    }

    const formatVN = (iso: string) => {
      const parts = iso.split('-')
      return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso
    }

    const dateDisplay =
      startDate === endDate
        ? formatVN(startDate)
        : `${formatVN(startDate)} – ${formatVN(endDate)}`

    try {
      setIsSaving(true)
      setModalError('')
      const supabase = createClient()

      const { error } = await supabase.from('leave_requests').insert([
        {
          employee_id: emp.id,
          name: emp.name,
          initials: emp.initials,
          department: emp.department,
          type: leaveType,
          reason: reasonText.trim(),
          date_range: dateDisplay,
          days_count: daysCountText.trim() || '1 ngày',
          tone: emp.tone || 'teal',
          status: 'Chờ duyệt',
        },
      ])

      if (error) {
        setModalError(`Không thể gửi đơn: ${error.message}`)
        return
      }

      setIsCreateModalOpen(false)
      onNotify(`Đã gửi đơn nghỉ phép cho ${emp.name}.`)
      await onRefresh()
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Lỗi kết nối.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdateLeaveStatus(targetId: number, nextStatus: 'Đã duyệt' | 'Từ chối') {
    if (!isAdmin) {
      onNotify('Chỉ Quản trị viên hoặc Quản lý mới có quyền phê duyệt.')
      return
    }

    const target = requests.find((r) => r.id === targetId)
    if (!target) return

    const rangeText = target.dateRange || target.date
    if (nextStatus === 'Đã duyệt' && target.employeeId) {
      const conflicts = getEmployeeShiftConflictsForLeave(target.employeeId, rangeText)
      if (conflicts.length > 0) {
        const confirmApprove = window.confirm(
          `CẢNH BÁO: Nhân viên ${target.name} đã có ${conflicts.length} ca làm việc trùng trong thời gian này (${rangeText}). Vẫn muốn duyệt?`,
        )
        if (!confirmApprove) return
      }
    }

    try {
      setIsSaving(true)
      setModalError('')
      const supabase = createClient()

      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetId)

      if (error) {
        setModalError(`Lỗi cập nhật: ${error.message}`)
        return
      }

      setReviewTarget(null)
      onNotify(`Đã cập nhật đơn sang: ${nextStatus}.`)
      await onRefresh()
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Lỗi kết nối.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <section className="metrics-grid" style={{ marginBottom: 18 }}>
        <article className="metric-card">
          <div className="metric-top">
            <span>Tổng số đơn nghỉ phép</span>
            <span className="metric-icon purple" style={{ fontWeight: 700, fontSize: 12 }}>ĐƠN</span>
          </div>
          <strong className="metric-value">{isLoading ? '...' : leaveMetrics.total}</strong>
          <p>Tất cả yêu cầu được ghi nhận</p>
        </article>
        <article className="metric-card">
          <div className="metric-top">
            <span>Đơn đang chờ duyệt</span>
            <span className="metric-icon orange" style={{ fontWeight: 700, fontSize: 12 }}>CHỜ</span>
          </div>
          <strong className="metric-value">{isLoading ? '...' : leaveMetrics.pending}</strong>
          <p>Yêu cầu cần xử lý</p>
        </article>
        <article className="metric-card">
          <div className="metric-top">
            <span>Đơn đã được duyệt</span>
            <span className="metric-icon teal" style={{ fontWeight: 700, fontSize: 12 }}>DUYỆT</span>
          </div>
          <strong className="metric-value">{isLoading ? '...' : leaveMetrics.approved}</strong>
          <p>Đã chấp thuận</p>
        </article>
        <article className="metric-card">
          <div className="metric-top">
            <span>Đơn bị từ chối</span>
            <span className="metric-icon blue" style={{ fontWeight: 700, fontSize: 12 }}>TỪ CHỐI</span>
          </div>
          <strong className="metric-value">{isLoading ? '...' : leaveMetrics.rejected}</strong>
          <p>Chưa đáp ứng điều kiện</p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading" style={{ flexWrap: 'wrap', gap: 14, borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>
          <div>
            <h2>Danh sách yêu cầu nghỉ phép & Đổi ca</h2>
            <p>Tạo mới đơn, theo dõi trạng thái và kiểm tra xung đột lịch.</p>
          </div>
          <button type="button" className="primary-button" onClick={handleOpenCreateModal}>
            + Tạo đơn nghỉ phép
          </button>
        </div>

        <div className="module-toolbar" style={{ flexWrap: 'wrap', gap: 10, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
          <div className="search-box" style={{ minWidth: 230, flex: '1 1 230px' }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm nhân viên, lý do..."
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
            >
              <option value="Tất cả">Tất cả phòng ban</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <div className="filter-pills">
              {['Tất cả', 'Chờ duyệt', 'Đã duyệt', 'Từ chối'].map((st) => (
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
          </div>
        </div>

        {isLoading ? (
          <div className="table-note" style={{ padding: '40px 22px', textAlign: 'center' }}>Đang tải...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="table-note" style={{ padding: '36px 22px', textAlign: 'center' }}>Không có đơn nào khớp.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Phòng ban</th>
                  <th>Loại đơn</th>
                  <th>Thời gian</th>
                  <th>Lý do</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => {
                  const rangeText = req.dateRange || req.date
                  const shiftConflicts = req.employeeId
                    ? getEmployeeShiftConflictsForLeave(req.employeeId, rangeText)
                    : []

                  return (
                    <tr key={req.id}>
                      <td>
                        <div className="employee-cell">
                          <span className={`avatar ${req.tone}`}>{req.initials}</span>
                          <div>
                            <strong>{req.name}</strong>
                            <small style={{ display: 'block', color: '#64748b' }}>#{req.id}</small>
                          </div>
                        </div>
                      </td>
                      <td>{req.department}</td>
                      <td><strong>{req.type}</strong></td>
                      <td>
                        <strong>{rangeText}</strong>
                        <small style={{ display: 'block', color: '#64748b' }}>{req.daysCount || req.days}</small>
                      </td>
                      <td>
                        <span style={{ display: 'inline-block', maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {req.reason}
                        </span>
                        {shiftConflicts.length > 0 && req.status === 'Chờ duyệt' && (
                          <span className="badge warning" style={{ display: 'block', width: 'fit-content', marginTop: 4 }}>
                            ⚠️ Trùng {shiftConflicts.length} ca
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${req.status === 'Đã duyệt' ? 'success' : req.status === 'Từ chối' ? 'danger' : 'warning'}`}>
                          {req.status}
                        </span>
                      </td>
                      <td>
                        <div className="action-group" style={{ gap: 6, flexWrap: 'wrap' }}>
                          {isAdmin && req.status === 'Chờ duyệt' && (
                            <>
                              <button type="button" className="mini-btn approve" onClick={() => handleUpdateLeaveStatus(req.id, 'Đã duyệt')}>Duyệt</button>
                              <button type="button" className="mini-btn reject" onClick={() => handleUpdateLeaveStatus(req.id, 'Từ chối')}>Từ chối</button>
                            </>
                          )}
                          <button type="button" className="mini-btn" onClick={() => setReviewTarget(req)} style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>Chi tiết</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal Tạo đơn & Modal Review giữ nguyên */}
      {isCreateModalOpen && (
        <dialog ref={createDialogRef} className="dashboard-modal" style={{ width: 'min(540px, 95vw)' }} onCancel={() => !isSaving && setIsCreateModalOpen(false)}>
          <div className="modal-heading">
            <h2>Tạo đơn xin nghỉ phép</h2>
            <button type="button" className="icon-button" onClick={() => setIsCreateModalOpen(false)}>✕</button>
          </div>
          {modalError && <div style={{ padding: '10px', background: '#fef2f2', color: '#b91c1c', marginBottom: 12 }}>{modalError}</div>}
          <form className="shift-form" onSubmit={handleCreateLeaveSubmit}>
            <label>
              Nhân viên
              <select value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)} required>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id} disabled={emp.status !== 'Đang hoạt động'}>
                    {emp.code} – {emp.name} ({emp.department})
                  </option>
                ))}
              </select>
            </label>
            <div className="form-split">
              <label>Loại đơn
                <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                  <option value="Nghỉ phép năm">Nghỉ phép năm</option>
                  <option value="Nghỉ việc riêng">Nghỉ việc riêng</option>
                  <option value="Nghỉ ốm">Nghỉ ốm</option>
                  <option value="Đổi ca làm việc">Đổi ca làm việc</option>
                </select>
              </label>
              <label>Thời lượng
                <input value={daysCountText} onChange={(e) => setDaysCountText(e.target.value)} required />
              </label>
            </div>
            <div className="form-split">
              <label>Từ ngày <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></label>
              <label>Đến ngày <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></label>
            </div>
            <label>Lý do <input value={reasonText} onChange={(e) => setReasonText(e.target.value)} required maxLength={140} /></label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button type="button" className="secondary-button" onClick={() => setIsCreateModalOpen(false)}>Hủy</button>
              <button type="submit" className="primary-button" disabled={isSaving}>Gửi đơn</button>
            </div>
          </form>
        </dialog>
      )}

      {reviewTarget && (
        <dialog ref={reviewDialogRef} className="dashboard-modal" style={{ width: 'min(540px, 95vw)' }} onCancel={() => setReviewTarget(null)}>
          <div className="modal-heading">
            <h2>Chi tiết đơn nghỉ phép</h2>
            <button type="button" className="icon-button" onClick={() => setReviewTarget(null)}>✕</button>
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            <div className="review-person" style={{ padding: '10px', background: '#f8fafc', borderRadius: 8 }}>
              <span className={`avatar ${reviewTarget.tone}`}>{reviewTarget.initials}</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 15 }}>{reviewTarget.name}</h3>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{reviewTarget.department}</p>
              </div>
            </div>
            <div>
              <strong>Khoảng thời gian:</strong> {reviewTarget.dateRange || reviewTarget.date} ({reviewTarget.daysCount || reviewTarget.days})
            </div>
            <div>
              <strong>Lý do:</strong> {reviewTarget.reason}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="secondary-button" onClick={() => setReviewTarget(null)}>Đóng</button>
              {isAdmin && reviewTarget.status === 'Chờ duyệt' && (
                <>
                  <button type="button" className="secondary-button" style={{ color: '#b91c1c' }} onClick={() => handleUpdateLeaveStatus(reviewTarget.id, 'Từ chối')}>Từ chối</button>
                  <button type="button" className="primary-button" onClick={() => handleUpdateLeaveStatus(reviewTarget.id, 'Đã duyệt')}>Duyệt</button>
                </>
              )}
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}