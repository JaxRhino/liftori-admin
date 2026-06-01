import { useCrm } from '../../contexts/CrmContext';

export default function CrmNotifications() {
  const { platform } = useCrm();
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">[BELL] Notifications</h1>
        <p className="text-sm text-slate-500 mt-1">Inbox of system events</p>
      </div>
      <div className="text-center text-slate-500 p-12 border border-dashed border-slate-300 rounded-lg">
        <div className="text-lg font-medium text-slate-700 mb-2">Notifications coming online</div>
        <div className="text-sm">Wired to notifications in Wave C - for now use the bell in the header.</div>
      </div>
    </div>
  );
}