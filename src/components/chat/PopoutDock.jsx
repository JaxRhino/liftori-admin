import React from 'react'
import { usePopoutChat } from '../../contexts/PopoutChatContext'
import DMPopout from './DMPopout'

/**
 * Container that renders all currently open DM pop-outs along the
 * bottom-right edge of the viewport. Mounted once at AdminLayout level.
 */
export default function PopoutDock() {
  const { popouts } = usePopoutChat()

  if (!popouts || popouts.length === 0) return null

  return (
    <>
      {popouts.map((entry, idx) => (
        <DMPopout
          key={entry.channelId}
          entry={entry}
          offsetIndex={idx}
        />
      ))}
    </>
  )
}
