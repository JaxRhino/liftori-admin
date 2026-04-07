import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { fetchLeadershipDashboard } from '../../lib/eosService';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Calendar, Target, BarChart3, AlertCircle, CheckSquare, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function EOSLeadershipDashboard() {
  const navigate = useNavigate();
  const { sidebarOpen } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const dashboardData = await fetchLeadershipDashboard();
        setData(dashboardData);
      } catch (error) {
        console.error('Failed to load leadership dashboard:', error);
        toast.error('Failed to load leadership dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const getHealthColor = (value) => {
    if (value >= 80) return 'text-green-400';
    if (value >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getHealthBgColor = (value) => {
    if (value >= 80) return 'bg-green-500/10';
    if (value >= 60) return 'bg-yellow-500/10';
    return 'bg-red-500/10';
  };

  const SummaryCard = ({ icon: Icon, label, value, unit = '%', colorClass }) => (
    <Card className={`bg-navy-800 border-navy-700 p-6 ${colorClass}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm font-medium mb-1">{label}</p>
          <p className={`text-4xl font-bold ${getHealthColor(value)}`}>
            {value}{unit}
          </p>
        </div>
        <Icon className="text-brand-blue w-8 h-8" />
      </div>
    </Card>
  );

  const SkeletonCard = () => (
    <Card className="bg-navy-800 border-navy-700 p-6 animate-pulse">
      <div className="space-y-3">
        <div className="h-4 bg-navy-700 rounded w-24"></div>
        <div className="h-10 bg-navy-700 rounded w-20"></div>
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className={`min-h-screen bg-navy-950 p-8 transition-all ${sidebarOpen ? 'ml-0' : 'ml-0'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-white mb-2">Leadership Dashboard</h1>
            <p className="text-gray-400">Executive overview of EOS implementation</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-navy-950 p-8 transition-all ${sidebarOpen ? 'ml-0' : 'ml-0'}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Leadership Dashboard</h1>
          <p className="text-gray-400">Executive overview of EOS implementation</p>
        </div>

        {/* Summary Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <SummaryCard
            icon={CheckSquare}
            label="L10 Completion Rate"
            value={data?.l10CompletionRate || 0}
            colorClass={getHealthBgColor(data?.l10CompletionRate || 0)}
          />
          <SummaryCard
            icon={Target}
            label="Rocks Progress"
            value={data?.rocksProgress || 0}
            colorClass={getHealthBgColor(data?.rocksProgress || 0)}
          />
          <SummaryCard
            icon={BarChart3}
            label="Scorecard Health"
            value={data?.scorecardHealth || 0}
            colorClass={getHealthBgColor(data?.scorecardHealth || 0)}
          />
          <SummaryCard
            icon={AlertCircle}
            label="Open Issues"
            value={data?.openIssuesCount || 0}
            unit=""
            colorClass="bg-orange-500/10"
          />
          <SummaryCard
            icon={CheckSquare}
            label="Action Items"
            value={data?.actionItemsCount || 0}
            unit=""
            colorClass="bg-blue-500/10"
          />
          <SummaryCard
            icon={Clock}
            label="Overdue To-Dos"
            value={data?.overdueCount || 0}
            unit=""
            colorClass="bg-red-500/10"
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button
              onClick={() => navigate('/eos/l10-meetings')}
              className="bg-brand-blue hover:bg-blue-600 text-white h-12 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <Calendar className="w-5 h-5" />
              Schedule L10
            </Button>
            <Button
              onClick={() => navigate('/eos/rocks')}
              className="bg-brand-blue hover:bg-blue-600 text-white h-12 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <Target className="w-5 h-5" />
              Review Rocks
            </Button>
            <Button
              onClick={() => navigate('/eos/issues')}
              className="bg-brand-blue hover:bg-blue-600 text-white h-12 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <AlertCircle className="w-5 h-5" />
              View Issues
            </Button>
            <Button
              onClick={() => navigate('/eos/scorecard')}
              className="bg-brand-blue hover:bg-blue-600 text-white h-12 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <BarChart3 className="w-5 h-5" />
              Check Scorecard
            </Button>
          </div>
        </div>

        {/* Footer Info */}
        <Card className="bg-navy-800 border-navy-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Dashboard Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-gray-400 mb-2">Last Updated</p>
              <p className="text-white font-semibold">
                {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleDateString() : 'Never'}
              </p>
            </div>
            <div>
              <p className="text-gray-400 mb-2">Team Health</p>
              <p className={`font-semibold ${getHealthColor(data?.teamHealth || 0)}`}>
                {data?.teamHealth || 0}%
              </p>
            </div>
            <div>
              <p className="text-gray-400 mb-2">EOS Maturity</p>
              <p className={`font-semibold ${getHealthColor(data?.eosMaturity || 0)}`}>
                {data?.eosMaturity || 0}%
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
