'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email')?.toString().trim()
  const password = formData.get('password')?.toString()

  if (!email) {
    return { field: 'email', error: 'Vui lòng nhập email công việc của bạn.' }
  }

  if (!password) {
    return { field: 'password', error: 'Vui lòng nhập mật khẩu.' }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { field: 'general', error: 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email')?.toString().trim()

  if (!email) {
    return { error: 'Vui lòng nhập địa chỉ email công việc để nhận liên kết đặt lại mật khẩu.' }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email)

  if (error) {
    return { error: 'Không thể gửi yêu cầu khôi phục mật khẩu lúc này. Vui lòng thử lại sau.' }
  }

  return { success: 'Hướng dẫn đặt lại mật khẩu đã được gửi tới email của bạn.' }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}