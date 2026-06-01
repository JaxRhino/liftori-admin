import { useCrm } from '../../contexts/CrmContext';

export default function CrmNotes() {
  const { platform } = useCrm();
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">[NOTES] Notes</h1>
        <p className="text-sm text-slate-500 mt-1">Capture notes, decisions, and team context</p>
      </div>
      <div className="text-center text-slate-500 p-12 border border-dashed border-slate-300 rounded-lg">
        <div className="text-lg font-medium text-slate-700 mb-2">Notes coming online</div>
        <div className="text-sm">Wired to admin_notes in Wave C.</div>
      </div>
    </div>
  );
}