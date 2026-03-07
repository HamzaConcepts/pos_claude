import { NextResponse } from 'next/server'
import { verifySuperAdminRequest } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const isValid = await verifySuperAdminRequest(request)

    if (!isValid) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({ authenticated: true })
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}
