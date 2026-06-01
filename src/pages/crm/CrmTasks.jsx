import { useCrm } from '../../contexts/CrmContext';

export default function CrmTasks() {
  const { platform } = useCrm();
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">[TASKS] Tasks</h1>
        <p className="text-sm text-slate-500 mt-1">Track to-dos across sales, ops, and EOS</p>
      </div>
      <div className="text-center text-slate-500 p-12 border border-dashed border-slate-300 rounded-lg">
        <div className="text-lg font-medium text-slate-700 mb-2">Tasks coming online</div>
        <div className="text-sm">Wired to admin_tasks + eos_todos in Wave C.</div>
      </div>
    </div>
  );
}