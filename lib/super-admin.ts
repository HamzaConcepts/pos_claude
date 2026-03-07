import { createClient } from '@supabase/supabase-js'

export const COOKIE_NAME = 'super_admin_token'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function extractTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || ''
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  return match ? match[1] : null
}

/**
 * Returns the super-admin Supabase user if the request is authenticated
 * and the account has role === 'super_admin' in user_metadata. Returns null otherwise.
 */
export async function getSuperAdminUser(request: Request): Promise<{ id: string } | null> {
  const token = extractTokenFromRequest(request)
  if (!token) return null
  try {
    const supabaseAdmin = getAdminClient()
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    if (user.user_metadata?.role !== 'super_admin') return null
    return { id: user.id }
  } catch {
    return null
  }
}

/** Convenience boolean check — used by all existing API routes. */
export async function verifySuperAdminRequest(request: Request): Promise<boolean> {
  return (await getSuperAdminUser(request)) !== null
}
