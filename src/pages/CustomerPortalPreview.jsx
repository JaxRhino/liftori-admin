import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

// Opens the customer portal as a demo customer so the team can preview the
// portal experience (nav + screens) from Dev Lab, with a Return-to-admin bar.
// Reuses the existing view-as-user impersonation — the real admin session is
// untouched; writes still happen as the admin.
const DEMO_CUSTOMER_ID = '08fe38d9-e92b-44e1-8bc4-b7c6c0c438b4'

export default function CustomerPortalPreview() {
  const { startImpersonation, canImpersonate } = useAuth()
  const navigate = useNavigate()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    if (!canImpersonate) return // wait until the founder profile resolves
    done.current = true
    startImpersonation(DEMO_CUSTOMER_ID)
    navigate('/portal', { replace: true })
  }, [canImpersonate, startImpersonation, navigate])

  return (
    <div className="p-8 text-slate-400 text-sm">Opening customer portal preview…</div>
  )
}
