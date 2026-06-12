// =====================================================================
// CrmEOS — tenant EOS shell. Navigation now lives in the sidebar EOS
// dropdown (mirrors internal Liftori EOS), so this just frames the
// active sub-page via <Outlet />.
// =====================================================================
import { Outlet } from 'react-router-dom'

export default function CrmEOS() {
  return <Outlet />
}
