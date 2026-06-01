import { useCrm } from '../../contexts/CrmContext';

export default function CrmCalendar() {
  const { platform } = useCrm();
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">[CAL] Calendar</h1>
        <p className="text-sm text-slate-500 mt-1">Schedule events, jobs, and team availability</p>
      </div>
      <div className="text-center text-slate-500 p-12 border border-dashed border-slate-300 rounded-lg">
        <div className="text-lg font-medium text-slate-700 mb-2">Calendar coming online</div>
        <div className="text-sm">Wave C will wire this to admin_calendar_events + ops_schedule. Drop notes you want on the roadmap into the bug report dialog.</div>
      </div>
    </div>
  );
}