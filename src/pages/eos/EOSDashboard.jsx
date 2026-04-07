import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { fetchDashboardStats } from '../../lib/eosService';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Calendar, CheckSquare, AlertCircle, ListTodo, Zap, BarChart3, Target, Users, FileText, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function EOSDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { sidebarOpen } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        if (user?.id) {
          const data = await fetchDashboardStats(user.id);
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        toast.error('Failed to load EOS dashboard stats');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [user?.id]);

  const quickStats = [
    {
      id: 'l10-meeting',
      title: 'Next L10 Meeting',
      value: stats?.nextL10Meeting || 'None scheduled',
      icon: Calendar,
      color: 'text-blue-400',
      onClick: () => navigate('/admin/eos/l10-meetings')
    },
    {
      id: 'scorecard',
      title: 'Scorecard',
      value: `${stats?.scorecard?.onTrack || 0}/${stats?.scorecard?.total || 0}`,
      subtext: 'metrics on track',
      icon: BarChart3,
      color: 'text-green-400',
      onClick: () => navigate('/admin/eos/scorecard')
    },
    {
      id: 'rocks',
      title: 'My Rocks',
      value: `${stats?.rocks?.onTrack || 0}/${stats?.rocks?.total || 0}`,
      subtext: 'on track',
      icon: Target,
      color: 'text-purple-400',
      onClick: () => navigate('/admin/eos/rocks')
    },
    {
      id: 'issues',
      title: 'Open Issues',
      value: stats?.openIssues || 0,
      icon: AlertCircle,
      color: 'text-orange-400',
      onClick: () => navigate('/admin/eos/issues')
    }
  ];

  const eosModules = [
    {
      title: 'Dashboard',
      description: 'EOS Hub overview',
      icon: BarChart3,
      path: '/admin/eos/dashboard'
    },
    {
      title: 'Scorecard',
      description: 'Track key metrics',
      icon: CheckSquare,
      path: '/admin/eos/scorecard'
    },
    {
      title: 'Rocks',
      description: 'Quarterly objectives',
      icon: Target,
      path: '/admin/eos/rocks'
    },
    {
      title: 'Issues',
      description: 'Problems to solve',
      icon: AlertCircle,
      path: '/admin/eos/issues'
    },
    {
      title: 'To-Dos',
      description: 'Action items',
      icon: ListTodo,
      path: '/admin/eos/todos'
    },
    {
      title: 'Headlines',
      description: 'Weekly updates',
      icon: FileText,
      path: '/admin/eos/headlines'
    },
    {
      title: 'L10 Meetings',
      description: 'Weekly meetings',
      icon: Users,
      path: '/admin/eos/l10-meetings'
    },
    {
      title: 'Accountability Chart',
      description: 'Org structure',
      icon: Users,
      path: '/admin/eos/accountability-chart'
    }
  ];

  const StatCard = ({ title, value, subtext, icon: Icon, color, onClick }) => (
    <Card
      className="bg-navy-800 border-navy-700 hover:border-brand-blue hover:bg-navy-700 cursor-pointer transition-all p-6"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
          <p className="text-white text-3xl font-bold">{value}</p>
          {subtext && <p className="text-gray-500 text-xs mt-1">{subtext}</p>}
        </div>
        <Icon className={`${color} w-8 h-8`} />
      </div>
    </Card>
  );

  const SkeletonCard = () => (
    <Card className="bg-navy-800 border-navy-700 p-6 animate-pulse">
      <div className="space-y-3">
        <div className="h-4 bg-navy-700 rounded w-24"></div>
        <div className="h-8 bg-navy-700 rounded w-16"></div>
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className={`min-h-screen bg-navy-950 p-8 transition-all ${sidebarOpen ? 'ml-0' : 'ml-0'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-white mb-2">EOS Hub</h1>
            <p className="text-gray-400">Entrepreneurial Operating System</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
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
          <h1 className="text-4xl font-bold text-white mb-2">EOS Hub</h1>
          <p className="text-gray-400">Entrepreneurial Operating System</p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {quickStats.map(stat => (
            <StatCard key={stat.id} {...stat} />
          ))}
        </div>

        {/* My To-Dos Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          <Card className="bg-navy-800 border-navy-700 p-6 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">My To-Dos</h3>
              <ListTodo className="text-brand-blue w-5 h-5" />
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-white">{stats?.todoCount || 0}</p>
              <p className="text-sm text-gray-400">
                {stats?.todoDueThisWeek || 0} due this week
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4 border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white"
                onClick={() => navigate('/admin/eos/todos')}
              >
                View All
              </Button>
            </div>
          </Card>

          {/* Recent Headlines */}
          <Card className="bg-navy-800 border-navy-700 p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Recent Headlines</h3>
              <FileText className="text-brand-blue w-5 h-5" />
            </div>
            <div className="space-y-3">
              {stats?.recentHeadlines && stats.recentHeadlines.length > 0 ? (
                stats.recentHeadlines.slice(0, 5).map((headline, idx) => (
                  <div key={idx} className="pb-3 border-b border-navy-700 last:border-b-0">
                    <p className="text-sm text-gray-300">{headline.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{headline.date}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-sm">No recent headlines</p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4 border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white"
                onClick={() => navigate('/admin/eos/headlines')}
              >
                View All Headlines
              </Button>
            </div>
          </Card>
        </div>

        {/* EOS Modules Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">EOS Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {eosModules.map((module, idx) => {
              const Icon = module.icon;
              return (
                <Card
                  key={idx}
                  className="bg-navy-800 border-navy-700 hover:border-brand-blue hover:bg-navy-700 cursor-pointer transition-all p-6"
                  onClick={() => navigate(module.path)}
                >
                  <Icon className="text-brand-blue w-8 h-8 mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">{module.title}</h3>
                  <p className="text-gray-400 text-sm">{module.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
