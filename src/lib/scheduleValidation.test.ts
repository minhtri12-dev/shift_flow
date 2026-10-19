// src/lib/scheduleValidation.test.ts

import {
  checkLeaveConflict,
  calculateAndCheckWorkHours,
  checkMinRestBetweenShifts,
  type LeaveRequestRecord,
} from './scheduleValidation'
import {
  findShiftTimeConflict,
  type ShiftTimeDefinition,
} from './scheduleConflict'

export function runFullScheduleValidationTests() {
  const results: { testName: string; passed: boolean; error?: string }[] = []

  function assert(testName: string, condition: boolean, message?: string) {
    if (condition) {
      results.push({ testName, passed: true })
    } else {
      results.push({ testName, passed: false, error: message || 'Failed' })
    }
  }

  const shiftMorning: ShiftTimeDefinition = { id: 1, name: 'Ca sáng', start: '08:00', end: '12:00' }
  const shiftAfternoon: ShiftTimeDefinition = { id: 2, name: 'Ca chiều', start: '13:00', end: '17:00' }
  const shiftOvernight: ShiftTimeDefinition = { id: 3, name: 'Ca đêm', start: '22:00', end: '06:00' }

  const shiftMap = new Map<number, ShiftTimeDefinition>([
    [1, shiftMorning],
    [2, shiftAfternoon],
    [3, shiftOvernight],
  ])

  // 1. Nhân viên có đơn nghỉ phép đã duyệt trùng ca: phải chặn lưu
  const approvedLeave: LeaveRequestRecord[] = [
    { id: 1, employee_id: 10, status: 'Đã duyệt', start_date: '2026-10-20', end_date: '2026-10-20' },
  ]
  const test1 = checkLeaveConflict({
    employeeId: 10,
    targetDate: '2026-10-20',
    targetShift: shiftMorning,
    leaveRequests: approvedLeave,
  })
  assert('1. Nhân viên có đơn nghỉ phép đã duyệt trùng ca phải bị chặn', test1.hasConflict === true)

  // 2. Nhân viên có đơn nghỉ phép đang chờ duyệt: không nhầm với đơn đã duyệt
  const pendingLeave: LeaveRequestRecord[] = [
    { id: 2, employee_id: 10, status: 'Chờ duyệt', start_date: '2026-10-20', end_date: '2026-10-20' },
  ]
  const test2 = checkLeaveConflict({
    employeeId: 10,
    targetDate: '2026-10-20',
    targetShift: shiftMorning,
    leaveRequests: pendingLeave,
  })
  assert('2. Đơn nghỉ phép Chờ duyệt không được chặn phân ca', test2.hasConflict === false)

  // 3. Ca nằm ngoài khoảng nghỉ phép: không bị chặn nhầm
  const outsideLeave: LeaveRequestRecord[] = [
    { id: 3, employee_id: 10, status: 'Đã duyệt', start_date: '2026-10-22', end_date: '2026-10-23' },
  ]
  const test3 = checkLeaveConflict({
    employeeId: 10,
    targetDate: '2026-10-20',
    targetShift: shiftMorning,
    leaveRequests: outsideLeave,
  })
  assert('3. Ca làm nằm ngoài khoảng nghỉ phép không bị chặn nhầm', test3.hasConflict === false)

  // 4. Ca qua đêm (22:00 ngày 19 -> 06:00 ngày 20) giao với ngày nghỉ phép 20/10: phát hiện chính xác
  const leaveDay20: LeaveRequestRecord[] = [
    { id: 4, employee_id: 10, status: 'Đã duyệt', start_date: '2026-10-20', end_date: '2026-10-20' },
  ]
  const test4 = checkLeaveConflict({
    employeeId: 10,
    targetDate: '2026-10-19',
    targetShift: shiftOvernight,
    leaveRequests: leaveDay20,
  })
  assert('4. Ca qua đêm kết thúc vào sáng ngày nghỉ phép đã duyệt phải bị phát hiện', test4.hasConflict === true)

  // 5. Tính tổng giờ làm nhiều ca trong tuần
  const existingWeekAssignments = [
    { id: 101, employeeId: 10, shiftId: 1, workDate: '2026-10-19', status: 'Đã phân công' }, // 4h
    { id: 102, employeeId: 10, shiftId: 2, workDate: '2026-10-20', status: 'Đã phân công' }, // 4h
  ]
  const test5 = calculateAndCheckWorkHours({
    employeeId: 10,
    targetDate: '2026-10-21',
    targetShift: shiftOvernight, // 8h
    existingAssignments: existingWeekAssignments,
    shiftDefinitions: shiftMap,
    policy: { maxWeeklyHours: 40 },
  })
  assert('5. Tính đúng tổng giờ tuần (4h + 4h + 8h = 16h)', test5.weeklyHours === 16)

  // 6. Chỉnh sửa một phân công không cộng trùng giờ của chính nó
  const test6 = calculateAndCheckWorkHours({
    employeeId: 10,
    targetDate: '2026-10-19',
    targetShift: shiftMorning, // 4h
    existingAssignments: existingWeekAssignments, // gồm bản ghi 101 tại ngày 19
    shiftDefinitions: shiftMap,
    excludeAssignmentId: 101,
  })
  assert('6. Không cộng trùng bản ghi đang chỉnh sửa', test6.dailyHours === 4)

  // 7. Phân công đã hủy không tính vào tổng giờ
  const withCancelled = [
    { id: 103, employeeId: 10, shiftId: 1, workDate: '2026-10-19', status: 'Đã hủy' },
  ]
  const test7 = calculateAndCheckWorkHours({
    employeeId: 10,
    targetDate: '2026-10-19',
    targetShift: shiftMorning,
    existingAssignments: withCancelled,
    shiftDefinitions: shiftMap,
  })
  assert('7. Ca đã hủy không bị tính vào tổng giờ', test7.dailyHours === 4)

  // 8. Thời gian nghỉ giữa hai ca được tính chính xác (Ca sáng 08-12 và Ca chiều 13-17: nghỉ 1h)
  const morningAssignment = [
    { id: 104, employeeId: 10, shiftId: 1, workDate: '2026-10-20', status: 'Đã phân công' },
  ]
  const test8 = checkMinRestBetweenShifts({
    employeeId: 10,
    targetDate: '2026-10-20',
    targetShift: shiftAfternoon,
    existingAssignments: morningAssignment,
    shiftDefinitions: shiftMap,
    policy: { minRestHours: 2, blockOnRestViolation: false },
  })
  assert('8. Phát hiện vi phạm thời gian nghỉ giữa ca (nghỉ 1h < 2h yêu cầu)', test8.violatesMinRest === true && test8.actualRestHours === 1)

  // 9. Xử lý lỗi khi dữ liệu nghỉ phép không hợp lệ (không âm thầm bỏ qua)
  let test9Passed = false
  try {
    checkLeaveConflict({
      employeeId: 10,
      targetDate: '2026-10-20',
      targetShift: shiftMorning,
      leaveRequests: null as unknown as LeaveRequestRecord[],
    })
  } catch {
    test9Passed = true
  }
  assert('9. Dữ liệu nghỉ phép lỗi/thất bại ném lỗi rõ ràng, không báo an toàn giả', test9Passed === true)

  // 10. Bộ kiểm tra trùng ca cũ tiếp tục hoạt động chính xác
  const test10 = findShiftTimeConflict({
    employeeId: 10,
    targetDate: '2026-10-20',
    targetShift: shiftMorning,
    existingAssignments: morningAssignment,
    shiftDefinitions: shiftMap,
  })
  assert('10. Kiểm tra trùng thời gian cũ vẫn hoạt động và phát hiện trùng ca', test10.hasConflict === true)

  const passedCount = results.filter((r) => r.passed).length
  return {
    total: results.length,
    passed: passedCount,
    failed: results.length - passedCount,
    results,
  }
}