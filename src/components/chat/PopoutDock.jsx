import React from 'react'
import { usePopoutChat } from '../../contexts/PopoutChatContext'
import DMPopout from './DMPopout'

/**
 * Error boundary so a single broken pop-out can never blank the
 * entire admin page. If a pop-out throws, log it and silently drop
 * the dock — the rest of the app keeps working.
 */
class PopoutErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(err, info) {
    // eslint-disable-next-line no-console
    console.error('[PopoutDock] crash isolated:', err, info)
  }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

/**
 * Container that renders all currently open DM pop-outs along the
 * bottom-right edge of the viewport. Mounted once at AdminLayout level.
 */
export default function PopoutDock() {
  const { popouts } = usePopoutChat()

  if (!popouts || popouts.length === 0) return null

  return (
    <PopoutErrorBoundary>
      {popouts.map((entry, idx) => (
        <DMPopout
          key={entry.channelId}
          entry={entry}
          offsetIndex={idx}
        />
      ))}
    </PopoutErrorBoundary>
  )
}
