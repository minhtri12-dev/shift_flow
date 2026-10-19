// src/lib/scheduleConflict.test.ts
import {
  doIntervalsOverlap,
  findShiftTimeConflict,
  getShiftInterval,
  type ShiftTimeDefinition,
} from './scheduleConflict'

export function runScheduleConflictTests(): {
  total: number
  passed: number
  failed: number
  results: { testName: string; passed: boolean; error?: string }[]
} {
  const results: { testName: string; passed: boolean; error?: string }[] = []

  function assert(testName: string, condition: boolean, message?: string) {
    if (condition) {
      results.push({ testName, passed: true })
    } else {
      results.push({ testName, passed: false, error: message || 'Failed assertion' })
    }
  }

  // Test 1: Hai ca chồng lấn cùng ngày (08:00–12:00 vs 10:00–14:00)
  const int1A = getShiftInterval('2026-10-20', '08:00', '12:00')
  const int1B = getShiftInterval('2026-10-20', '10:00', '14:00')
  assert('1. Hai ca chồng lấn cùng ngày phải trả về true', doIntervalsOverlap(int1A, int1B) === true)

  // Test 2: Hai ca không chồng lấn (08:00–12:00 vs 13:00–17:00)
  const int2A = getShiftInterval('2026-10-20', '08:00', '12:00')
  const int2B = getShiftInterval('2026-10-20', '13:00', '17:00')
  assert('2. Hai ca cách nhau phải trả về false', doIntervalsOverlap(int2A, int2B) === false)

  // Test 3: Hai ca tiếp nối đúng thời điểm (08:00–12:00 và 12:00–16:00)
  const int3 = getShiftInterval('2026-10-20', '08:00', '12:00')
  const int3Cont = getShiftInterval('2026-10-20', '12:00', '16:00')
  assert('3. Hai ca tiếp nối sát nhau (12:00 kết thúc / 12:00 bắt đầu) không chồng lấn', doIntervalsOverlap(int3, int3Cont) === false)

  // Test 4: Ca qua đêm 22:00 ngày 20 -> 06:00 ngày 21 và ca 05:00–09:00 ngày 21
  const overnightShift = getShiftInterval('2026-10-20', '22:00', '06:00')
  const nextMorningShift = getShiftInterval('2026-10-21', '05:00', '09:00')
  assert('4. Ca 22:00–06:00 phải chồng lấn với ca 05:00 ngày kế tiếp', doIntervalsOverlap(overnightShift, nextMorningShift) === true)

  // Test 5: Ca qua đêm 22:00 ngày 20 -> 06:00 ngày 21 và ca 06:00–10:00 ngày 21 (tiếp nối, không trùng)
  const morningAfterOvernight = getShiftInterval('2026-10-21', '06:00', '10:00')
  assert('5. Ca 22:00–06:00 tiếp nối với ca 06:00 ngày kế tiếp không chồng lấn', doIntervalsOverlap(overnightShift, morningAfterOvernight) === false)

  // Test 6: Kiểm tra excludeAssignmentId khi chỉnh sửa bản ghi hiện có
  const shiftsMap = new Map<number, ShiftTimeDefinition>([
    [1, { id: 1, name: 'Ca sáng', start: '08:00', end: '12:00' }],
    [2, { id: 2, name: 'Ca chiều', start: '13:00', end: '17:00' }],
  ])

  const existing = [
    { id: 101, employeeId: 1, shiftId: 1, workDate: '2026-10-20', status: 'Đã phân công' },
  ]

  const editSelf = findShiftTimeConflict({
    employeeId: 1,
    targetShift: shiftsMap.get(1)!,
    targetDate: '2026-10-20',
    existingAssignments: existing,
    shiftDefinitions: shiftsMap,
    excludeAssignmentId: 101,
  })
  assert('6. Chỉnh sửa chính bản ghi ID 101 không bị tự xung đột với chính nó', editSelf.hasConflict === false)

  const passed = results.filter((r) => r.passed).length
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  }
}