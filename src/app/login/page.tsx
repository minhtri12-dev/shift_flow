'use client'

import { useState } from 'react'
import { login, resetPassword } from '@/actions/auth'
import { Eye, EyeOff, ArrowRight, Lock, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isResetMode, setIsResetMode] = useState(false)
  const [errorState, setErrorState] = useState<{ field?: string; message: string } | null>(null)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)

  async function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setErrorState(null)

    const formData = new FormData(event.currentTarget)
    const result = await login(formData)

    if (result?.error) {
      setErrorState({ field: result.field, message: result.error })
      setIsLoading(false)
    }
  }

  async function handleResetSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setErrorState(null)
    setResetSuccess(null)

    const formData = new FormData(event.currentTarget)
    const result = await resetPassword(formData)

    if (result?.error) {
      setErrorState({ field: 'email', message: result.error })
    } else if (result?.success) {
      setResetSuccess(result.success)
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white font-sans antialiased overflow-x-hidden selection:bg-[#079E91]/20 selection:text-[#079E91]">
      <section className="relative w-full lg:w-[53%] bg-[#071C33] text-white flex flex-col justify-between px-8 py-8 sm:px-12 sm:py-10 lg:px-14 lg:py-11 xl:px-20 overflow-hidden shrink-0">
        <div
          className="absolute inset-0 pointer-events-none opacity-90"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.025) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />

        <div className="
          absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full
          border border-white/[0.06] pointer-events-none
        " />

        <div className="
          absolute bottom-12 left-1/3 w-[340px] h-[340px] rounded-full
          bg-[#079E91]/[0.06] blur-[90px] pointer-events-none
        " />

        <header className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#09B5A5] flex items-center justify-center shadow-sm">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-5 h-5 text-[#071C33]"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <line x1="8" y1="2" x2="8" y2="5" />
              <line x1="16" y1="2" x2="16" y2="5" />
              <path d="M7 14c1.5-2 3-2 4.5 0s3 2 4.5 0" />
              <circle cx="17" cy="10" r="1" fill="currentColor" />
            </svg>
          </div>
          <span className="text-[20px] font-bold tracking-tight text-white">ShiftFlow</span>
        </header>

        <div className="relative z-10 my-auto pt-10 pb-6 lg:py-6">
          <p className="text-[#0BB5A6] text-[11px] font-bold uppercase tracking-[0.18em] mb-4">
            WORKFORCE MANAGEMENT
          </p>

          <h1 className="text-3xl sm:text-4xl xl:text-[42px] font-bold text-white leading-[1.2] tracking-tight mb-5">
            Quản lý nhân sự.
            <br />
            Tối ưu mọi ca làm.
          </h1>

          <p className="text-slate-300/85 text-sm sm:text-[15px] leading-[1.65] max-w-[430px] mb-8 lg:mb-10">
            Một nền tảng thống nhất cho chấm công, lịch làm việc và vận hành nhân sự.
          </p>

          <div className="w-full max-w-[460px] select-none">
            <svg
              viewBox="0 0 460 220"
              className="w-full h-auto overflow-visible"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="14"
                y="12"
                width="142"
                height="90"
                rx="10"
                fill="#0D2542"
                fillOpacity="0.65"
                stroke="#1E3A5F"
                strokeWidth="1.2"
              />
              <circle cx="28" cy="25" r="2.8" fill="#334E68" />
              <circle cx="38" cy="25" r="2.8" fill="#334E68" />
              <line x1="14" y1="36" x2="156" y2="36" stroke="#1E3A5F" strokeWidth="1" />
              <rect x="26" y="50" width="34" height="7" rx="3.5" fill="#2A4365" />
              <rect x="68" y="50" width="28" height="7" rx="3.5" fill="#1E3A5F" />
              <rect x="104" y="50" width="34" height="7" rx="3.5" fill="#2A4365" />
              <rect x="26" y="67" width="24" height="7" rx="3.5" fill="#1E3A5F" />
              <rect x="58" y="67" width="44" height="7" rx="3.5" fill="#2A4365" />
              <rect x="110" y="67" width="28" height="7" rx="3.5" fill="#1E3A5F" />
              <circle cx="96" cy="25" r="4.5" fill="#0BB5A6" />

              <rect
                x="232"
                y="12"
                width="142"
                height="72"
                rx="10"
                fill="#0D2542"
                fillOpacity="0.65"
                stroke="#1E3A5F"
                strokeWidth="1.2"
              />
              <circle
                cx="262"
                cy="48"
                r="16"
                fill="#0A2E3D"
                stroke="#0BB5A6"
                strokeOpacity="0.55"
                strokeWidth="1.2"
              />
              <circle cx="262" cy="43.5" r="4.2" fill="#2DD4BF" />
              <path
                d="M253.5 56C253.5 51.5 270.5 51.5 270.5 56"
                stroke="#2DD4BF"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="282" cy="41" r="3.5" fill="#0BB5A6" />
              <rect x="292" y="38" width="60" height="7" rx="3.5" fill="#2A4365" />
              <rect x="292" y="52" width="42" height="6" rx="3" fill="#1E3A5F" />

              <path
                d="M96 25 C 124 62, 118 108, 152 138"
                stroke="#0BB5A6"
                strokeWidth="1.3"
                strokeDasharray="4 4"
                strokeOpacity="0.7"
              />
              <path
                d="M36 138 C 82 104, 168 106, 246 48"
                stroke="#0BB5A6"
                strokeWidth="1.3"
                strokeDasharray="4 4"
                strokeOpacity="0.7"
              />

              <circle
                cx="36"
                cy="158"
                r="20"
                fill="#0D2542"
                fillOpacity="0.85"
                stroke="#2A4365"
                strokeWidth="1.4"
              />
              <circle cx="36" cy="152" r="5" fill="#94A3B8" />
              <path
                d="M26 167.5C26 161.5 46 161.5 46 167.5"
                stroke="#94A3B8"
                strokeWidth="2.2"
                strokeLinecap="round"
              />

              <rect
                x="132"
                y="116"
                width="162"
                height="80"
                rx="10"
                fill="#0D2542"
                fillOpacity="0.65"
                stroke="#1E3A5F"
                strokeWidth="1.2"
              />
              <circle cx="152" cy="138" r="5" fill="#0BB5A6" />
              <rect x="166" y="135" width="74" height="7" rx="3.5" fill="#2A4365" />
              <rect x="166" y="149" width="104" height="7" rx="3.5" fill="#1E3A5F" />
              <rect x="148" y="172" width="38" height="6" rx="3" fill="#1E3A5F" />
              <rect x="194" y="172" width="28" height="6" rx="3" fill="#1E3A5F" />

              <circle
                cx="326"
                cy="142"
                r="14"
                fill="#0D2542"
                fillOpacity="0.85"
                stroke="#2A4365"
                strokeWidth="1.3"
              />
              <circle cx="326" cy="138" r="3.6" fill="#94A3B8" />
              <path
                d="M319 149C319 145 333 145 333 149"
                stroke="#94A3B8"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        <footer className="relative z-10 flex items-center gap-3 pt-4">
          <span className="w-6 h-[1.5px] bg-[#0BB5A6] inline-block" />
          <p className="text-xs text-slate-400">
            Đơn giản hóa vận hành. Tập trung vào con người.
          </p>
        </footer>
      </section>

      <main className="w-full lg:w-[47%] bg-[#FCFCFD] flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16">
        <div className="hidden lg:block" />

        <div className="w-full max-w-[384px] mx-auto my-auto py-8">
          <p className="text-[#079E91] text-[11px] font-bold uppercase tracking-[0.14em] mb-2.5">
            SHIFTFLOW WORKSPACE
          </p>

          {!isResetMode ? (
            <>
              <h2 className="text-[28px] font-bold text-slate-900 tracking-tight leading-snug mb-1.5">
                Chào mừng trở lại
              </h2>
              <p className="text-sm text-slate-500 mb-7">
                Đăng nhập vào không gian làm việc của bạn.
              </p>

              <form onSubmit={handleLoginSubmit} className="space-y-5" noValidate>
                {errorState?.field === 'general' && (
                  <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-600">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{errorState.message}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Email công việc
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="name@company.com"
                    className={`w-full h-11 px-3.5 rounded-lg border text-sm text-slate-900 placeholder:text-slate-400 bg-white transition-colors focus:outline-none focus:ring-2 ${
                      errorState?.field === 'email'
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                        : 'border-slate-200 hover:border-slate-300 focus:border-[#079E91] focus:ring-[#079E91]/15'
                    }`}
                  />
                  {errorState?.field === 'email' && (
                    <p className="text-xs text-red-600 pt-0.5">{errorState.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      placeholder="Nhập mật khẩu của bạn"
                      className={`w-full h-11 pl-3.5 pr-10 rounded-lg border text-sm text-slate-900 placeholder:text-slate-400 bg-white transition-colors focus:outline-none focus:ring-2 ${
                        errorState?.field === 'password'
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                          : 'border-slate-200 hover:border-slate-300 focus:border-[#079E91] focus:ring-[#079E91]/15'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errorState?.field === 'password' && (
                    <p className="text-xs text-red-600 pt-0.5">{errorState.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-[#079E91] focus:ring-[#079E91]/30 cursor-pointer accent-[#079E91]"
                    />
                    <span className="text-xs text-slate-600">Ghi nhớ đăng nhập</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(true)
                      setErrorState(null)
                      setResetSuccess(null)
                    }}
                    className="text-xs font-semibold text-[#079E91] hover:text-[#068277] transition-colors focus:outline-none"
                  >
                    Quên mật khẩu?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-lg bg-[#079E91] hover:bg-[#06877B] active:bg-[#057369] disabled:opacity-65 disabled:pointer-events-none text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#079E91]/30 focus:ring-offset-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <>
                      <span>Đăng nhập</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-[26px] font-bold text-slate-900 tracking-tight leading-snug mb-1.5">
                Khôi phục mật khẩu
              </h2>
              <p className="text-sm text-slate-500 mb-7">
                Nhập email công việc của bạn để nhận hướng dẫn đặt lại mật khẩu.
              </p>

              <form onSubmit={handleResetSubmit} className="space-y-5" noValidate>
                {errorState && (
                  <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-600">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{errorState.message}</span>
                  </div>
                )}

                {resetSuccess && (
                  <div className="flex items-start gap-2.5 rounded-lg bg-teal-50 border border-teal-200 px-3.5 py-2.5 text-xs text-teal-800">
                    <CheckCircle2 className="w-4 h-4 text-[#079E91] shrink-0 mt-0.5" />
                    <span>{resetSuccess}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="reset-email"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Email công việc
                  </label>
                  <input
                    id="reset-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="name@company.com"
                    className="w-full h-11 px-3.5 rounded-lg border border-slate-200 hover:border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 bg-white transition-colors focus:outline-none focus:border-[#079E91] focus:ring-2 focus:ring-[#079E91]/15"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-lg bg-[#079E91] hover:bg-[#06877B] disabled:opacity-65 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-[#079E91]/30"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang gửi yêu cầu...</span>
                    </>
                  ) : (
                    <span>Gửi liên kết khôi phục</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(false)
                    setErrorState(null)
                    setResetSuccess(null)
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 py-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Quay lại đăng nhập</span>
                </button>
              </form>
            </>
          )}

          <div className="mt-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200/80" />
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Thông tin của bạn được bảo vệ an toàn.</span>
            </div>
            <div className="h-px flex-1 bg-slate-200/80" />
          </div>
        </div>

        <footer className="text-center pt-4">
          <p className="text-[11px] text-slate-400">
            © 2026 ShiftFlow. Mọi quyền được bảo lưu.
          </p>
        </footer>
      </main>
    </div>
  )
}