// src/lib/scheduleConflict.ts

export type ShiftTimeDefinition = {
  id: number
  name: string
  start: string // Định dạng 'HH:mm'
  end: string   // Định dạng 'HH:mm'
}

export type AssignmentForConflictCheck = {
  id?: number
  employeeId: number
  shiftId: number
  workDate: string // Định dạng 'YYYY-MM-DD'
  status?: string
}

export type TimeInterval = {
  startMinutes: number
  endMinutes: number
}

/**
 * Chuyển đổi ngày và giờ thành số phút tuyệt đối từ mốc năm 2000 để so sánh giữa các ngày
 */
export function getAbsoluteMinutes(dateIso: string, timeHHmm: string): number {
  const [year, month, day] = dateIso.split('-').map(Number)
  const [hour, minute] = timeHHmm.split(':').map(Number)
  
  // Tính số ngày tính từ ngày 01-01-2000 (sử dụng Date.UTC an toàn)
  const daysSinceEpoch = Math.floor(
    Date.UTC(year, month - 1, day) / (1000 * 60 * 60 * 24)
  )
  return daysSinceEpoch * 24 * 60 + hour * 60 + minute
}

/**
 * Xác định khoảng thời gian tuyệt đối của một ca làm việc
 * Hỗ trợ ca qua đêm: nếu endTime <= startTime thì ca kết thúc vào ngày hôm sau (+ 24h)
 */
export function getShiftInterval(
  workDate: string,
  startTime: string,
  endTime: string
): TimeInterval {
  const startMinutes = getAbsoluteMinutes(workDate, startTime)
  let endMinutes = getAbsoluteMinutes(workDate, endTime)

  // Nếu giờ kết thúc nhỏ hơn hoặc bằng giờ bắt đầu -> ca kéo dài qua nửa đêm (hôm sau)
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60
  }

  return { startMinutes, endMinutes }
}

/**
 * Kiểm tra 2 khoảng thời gian có chồng lấn (overlap) nhau hay không.
 * Lưu ý: Hai ca tiếp nối sát nhau (endA === startB hoặc endB === startA) KHÔNG bị xem là chồng lấn.
 */
export function doIntervalsOverlap(
  intervalA: TimeInterval,
  intervalB: TimeInterval
): boolean {
  return (
    Math.max(intervalA.startMinutes, intervalB.startMinutes) <
    Math.min(intervalA.endMinutes, intervalB.endMinutes)
  )
}

/**
 * Kiểm tra xem một ca dự kiến phân công có bị trùng thời gian với các ca khác của nhân viên không.
 * Bỏ qua chính bản ghi đang chỉnh sửa (excludeAssignmentId) và các ca có trạng thái 'Đã hủy'.
 */
export function findShiftTimeConflict(params: {
  employeeId: number
  targetShift: ShiftTimeDefinition
  targetDate: string
  existingAssignments: AssignmentForConflictCheck[]
  shiftDefinitions: Map<number, ShiftTimeDefinition>
  excludeAssignmentId?: number
}): {
  hasConflict: boolean
  conflictingAssignment?: AssignmentForConflictCheck
  conflictingShift?: ShiftTimeDefinition
  reason?: string
} {
  const {
    employeeId,
    targetShift,
    targetDate,
    existingAssignments,
    shiftDefinitions,
    excludeAssignmentId,
  } = params

  const targetInterval = getShiftInterval(
    targetDate,
    targetShift.start,
    targetShift.end
  )

  // Chỉ xét các ca của cùng nhân viên đó, còn hiệu lực và khác với ca đang sửa
  const employeeAssignments = existingAssignments.filter((a) => {
    if (a.employeeId !== employeeId) return false
    if (excludeAssignmentId && a.id === excludeAssignmentId) return false
    if (a.status === 'Đã hủy') return false
    return true
  })

  for (const assignment of employeeAssignments) {
    const shiftDef = shiftDefinitions.get(assignment.shiftId)
    if (!shiftDef) continue

    const existingInterval = getShiftInterval(
      assignment.workDate,
      shiftDef.start,
      shiftDef.end
    )

    if (doIntervalsOverlap(targetInterval, existingInterval)) {
      return {
        hasConflict: true,
        conflictingAssignment: assignment,
        conflictingShift: shiftDef,
        reason: `Trùng giờ với ca "${shiftDef.name}" (${shiftDef.start} – ${shiftDef.end}) vào ngày ${assignment.workDate}`,
      }
    }
  }

  return { hasConflict: false }
}