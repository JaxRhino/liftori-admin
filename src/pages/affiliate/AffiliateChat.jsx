import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Chat redirect — for now, affiliates use the same Liftori Chat system as internal team.
 * Forward to /admin/chat. Future: dedicated creator-only channels.
 */
export default function AffiliateChat() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/admin/chat', { replace: true })
  }, [navigate])
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-sm text-gray-500">Redirecting to Liftori Chat…</div>
    </div>
  )
}
