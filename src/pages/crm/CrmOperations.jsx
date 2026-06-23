// =====================================================================
// CrmOperations - Operations hub shell.
// Sub-navigation is handled by the left sidebar dropdown (consistent with
// Sales / EOS), so this is just a passthrough that renders the active
// sub-route. The parent route's index redirects to dashboard (see App.jsx).
// =====================================================================

import { Outlet } from 'react-router-dom'

export default function CrmOperations() {
  return <Outlet />
}
