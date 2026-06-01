import { useCrm } from '../../contexts/CrmContext';

export default function CrmEOS() {
  const { platform } = useCrm();
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">[EOS] EOS</h1>
        <p className="text-sm text-slate-500 mt-1">Run on EOS: Rocks, Issues, Scorecard, Meetings</p>
      </div>
      <div className="text-center text-slate-500 p-12 border border-dashed border-slate-300 rounded-lg">
        <div className="text-lg font-medium text-slate-700 mb-2">EOS coming online</div>
        <div className="text-sm">Wired to all 9 eos_* tables in Wave C with sub-tabs.</div>
      </div>
    </div>
  );
}