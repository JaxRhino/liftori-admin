import ClientChat from '../ClientChat'

export default function PortalMessages() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Messages</h1>
        <p className="text-gray-400 text-sm mt-1">Chat directly with the Liftori team</p>
      </div>
      <ClientChat />
    </div>
  )
}
