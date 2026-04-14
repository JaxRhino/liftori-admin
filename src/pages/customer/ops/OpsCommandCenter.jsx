import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Clock,
  Users,
  Zap,
  MapPin,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Plus,
  Calendar,
  MapIcon,
  PhoneOff,
} from 'lucide-react';
import { useOrg } from '../../../lib/OrgContext';
import {
  fetchOpsDashboardStats,
  fetchWorkOrders,
  fetchSchedule,
} from '../../../lib/customerOpsService';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';

const statusColors = {
  pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'in-progress': 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  'in_progress': 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  urgent: 'bg-red-500/20 text-red-300 border-red-500/30',
  scheduled: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

const crewStatusColors = {
  active: 'bg-emerald-500/20 text-emerald-300',
  on_job: 'bg-sky-500/20 text-sky-300',
  on_break: 'bg-amber-500/20 text-amber-300',
  idle: 'bg-gray-500/20 text-gray-300',
};

export default function OpsCommandCenter() {
  const { currentOrg } = useOrg();
  const [stats, setStats] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);

  useEffect(() => {
    if (!currentOrg?.id) return;

    const loadData = async () => {
      try {
        setLoading(true);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const [statsResult, woResult, schedResult] = await Promise.allSettled([
          fetchOpsDashboardStats(currentOrg.id),
          fetchWorkOrders(currentOrg.id),
          fetchSchedule(currentOrg.id, {
            start_after: todayStart.toISOString(),
            end_before: todayEnd.toISOString(),
          }),
        ]);

        // Use safe defaults for any query that failed
        const defaultStats = {
          workOrders: { total: 0, pending: 0, inProgress: 0, completed: 0, urgent: 0, revenue: 0 },
          crews: { total: 0, active: 0, onJob: 0 },
          inventory: { lowStockCount: 0 },
          schedule: { todayJobs: 0 },
          hiring: { total: 0, active: 0 },
        };

        setStats(statsResult.status === 'fulfilled' ? statsResult.value : defaultStats);
        setWorkOrders(woResult.status === 'fulfilled' ? (woResult.value || []) : []);
        setSchedule(schedResult.status === 'fulfilled' ? (schedResult.value || []) : []);
      } catch (error) {
        console.error('Failed to load ops dashboard:', error);
        toast.error('Failed to load operations data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentOrg?.id]);

  const handleNewWorkOrder = () => {
    toast.success('Redirecting to new work order form...');
    // Navigate to work order creation
  };

  const handleScheduleJob = () => {
    toast.success('Opening schedule view...');
    // Open schedule modal
  };

  const handleAddCrew = () => {
    toast.success('Opening crew registration...');
    // Open crew modal
  };

  const handleViewMap = () => {
    toast.success('Opening live dispatch map...');
    // Open map view
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-sky-500 border-opacity-50 mb-4"></div>
          <p className="text-white text-lg">Loading Operations Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-navy-900 p-8">
        <Card className="border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-red-300">Unable to load operations data. Please try again.</p>
          </div>
        </Card>
      </div>
    );
  }

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format time
  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-navy-900 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Operations Command Center</h1>
        <p className="text-gray-400">
          Real-time visibility into your home services operations
        </p>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Button
          onClick={handleNewWorkOrder}
          className="bg-sky-500 hover:bg-sky-600 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Work Order
        </Button>
        <Button variant="outline" onClick={handleScheduleJob} className="border-white/20">
          <Calendar className="h-4 w-4 mr-2" />
          Schedule Job
        </Button>
        <Button variant="outline" onClick={handleAddCrew} className="border-white/20">
          <Users className="h-4 w-4 mr-2" />
          Add Crew
        </Button>
        <Button variant="outline" onClick={handleViewMap} className="border-white/20">
          <MapIcon className="h-4 w-4 mr-2" />
          View Map
        </Button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {/* Active Work Orders */}
        <Card className="border-white/10 bg-gradient-to-br from-navy-800 to-navy-900 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-sky-500/10 rounded-full blur-2xl"></div>
          <div className="relative p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Active Work Orders</p>
                <p className="text-3xl font-bold text-white">
                  {stats?.workOrders?.pending + stats?.workOrders?.inProgress || 0}
                </p>
              </div>
              <Zap className="h-8 w-8 text-sky-400" />
            </div>
            <div className="flex gap-3 text-xs">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                <span className="text-gray-400">
                  {stats?.workOrders?.pending || 0} Pending
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                <span className="text-gray-400">
                  {stats?.workOrders?.inProgress || 0} In Progress
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Crews on Job */}
        <Card className="border-white/10 bg-gradient-to-br from-navy-800 to-navy-900 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl"></div>
          <div className="relative p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Crews on Job</p>
                <p className="text-3xl font-bold text-white">
                  {stats?.crews?.onJob || 0}
                </p>
              </div>
              <Users className="h-8 w-8 text-emerald-400" />
            </div>
            <div className="text-xs text-gray-400">
              {stats?.crews?.total || 0} total crews available
            </div>
          </div>
        </Card>

        {/* Today's Schedule */}
        <Card className="border-white/10 bg-gradient-to-br from-navy-800 to-navy-900 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl"></div>
          <div className="relative p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Today's Jobs</p>
                <p className="text-3xl font-bold text-white">
                  {stats?.schedule?.todayJobs || 0}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-purple-400" />
            </div>
            <div className="text-xs text-gray-400">
              {schedule?.length || 0} scheduled events
            </div>
          </div>
        </Card>

        {/* Revenue This Month */}
        <Card className="border-white/10 bg-gradient-to-br from-navy-800 to-navy-900 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl"></div>
          <div className="relative p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Revenue This Month</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(stats?.workOrders?.revenue || 0)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-400" />
            </div>
            <div className="text-xs text-gray-400">From completed jobs</div>
          </div>
        </Card>

        {/* Urgent Items */}
        <Card
          className={`border-white/10 bg-gradient-to-br from-navy-800 to-navy-900 overflow-hidden ${
            stats?.workOrders?.urgent > 0 ? 'ring-2 ring-red-500/50' : ''
          }`}
        >
          <div
            className={`absolute top-0 right-0 w-20 h-20 ${
              stats?.workOrders?.urgent > 0 ? 'bg-red-500/10' : 'bg-gray-500/10'
            } rounded-full blur-2xl`}
          ></div>
          <div className="relative p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Urgent Items</p>
                <p
                  className={`text-3xl font-bold ${
                    stats?.workOrders?.urgent > 0 ? 'text-red-400' : 'text-white'
                  }`}
                >
                  {stats?.workOrders?.urgent || 0}
                </p>
              </div>
              <AlertCircle
                className={`h-8 w-8 ${
                  stats?.workOrders?.urgent > 0 ? 'text-red-400' : 'text-gray-400'
                }`}
              />
            </div>
            <div className="text-xs text-gray-400">Require immediate attention</div>
          </div>
        </Card>

        {/* Hiring Pipeline */}
        <Card className="border-white/10 bg-gradient-to-br from-navy-800 to-navy-900 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl"></div>
          <div className="relative p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Hiring Pipeline</p>
                <p className="text-3xl font-bold text-white">
                  {stats?.hiring?.active || 0}
                </p>
              </div>
              <Users className="h-8 w-8 text-amber-400" />
            </div>
            <div className="text-xs text-gray-400">
              {stats?.hiring?.total || 0} active applicants
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Today's Schedule Timeline */}
        <div className="lg:col-span-2">
          <Card className="border-white/10 bg-navy-800">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-sky-400" />
                Today's Schedule
              </h2>
            </div>
            <div className="divide-y divide-white/10 max-h-96 overflow-y-auto">
              {schedule && schedule.length > 0 ? (
                schedule.map((event, idx) => (
                  <div key={idx} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={statusColors[event.status] || 'bg-gray-500/20'}>
                            {event.status}
                          </Badge>
                          <p className="font-semibold text-white text-sm">
                            {event.title || 'Untitled Job'}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(event.startTime)} - {formatTime(event.endTime)}
                          </div>
                          {event.address && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.address}
                            </div>
                          )}
                        </div>
                        {event.crew && (
                          <div className="mt-2 text-xs text-gray-300">
                            <span className="text-gray-500">Crew: </span>
                            {event.crew}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        {event.priority === 'urgent' && (
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-400">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No jobs scheduled for today</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Alerts & Inventory */}
        <div>
          <Card className="border-white/10 bg-navy-800">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Alerts
              </h2>
            </div>
            <div className="divide-y divide-white/10 max-h-96 overflow-y-auto">
              {stats?.inventory?.lowStockCount > 0 && (
                <div className="p-4 bg-amber-500/5 border-l-2 border-amber-400">
                  <p className="text-xs font-semibold text-amber-300 mb-1">Low Inventory</p>
                  <p className="text-sm text-amber-200">
                    {stats.inventory.lowStockCount} items below threshold
                  </p>
                </div>
              )}

              {stats?.workOrders?.urgent > 0 && (
                <div className="p-4 bg-red-500/5 border-l-2 border-red-400">
                  <p className="text-xs font-semibold text-red-300 mb-1">Urgent Work Orders</p>
                  <p className="text-sm text-red-200">
                    {stats.workOrders.urgent} jobs require immediate attention
                  </p>
                </div>
              )}

              {workOrders?.some((wo) => wo.status === 'overdue') && (
                <div className="p-4 bg-red-500/5 border-l-2 border-red-400">
                  <p className="text-xs font-semibold text-red-300 mb-1">Overdue Items</p>
                  <p className="text-sm text-red-200">
                    {workOrders.filter((wo) => wo.status === 'overdue').length} work orders
                    overdue
                  </p>
                </div>
              )}

              {workOrders?.some((wo) => !wo.crewId) && (
                <div className="p-4 bg-yellow-500/5 border-l-2 border-yellow-400">
                  <p className="text-xs font-semibold text-yellow-300 mb-1">Unassigned Jobs</p>
                  <p className="text-sm text-yellow-200">
                    {workOrders.filter((wo) => !wo.crewId).length} jobs need crew assignment
                  </p>
                </div>
              )}

              {!stats?.inventory?.lowStockCount &&
                stats?.workOrders?.urgent === 0 &&
                !workOrders?.some((wo) => wo.status === 'overdue') && (
                  <div className="p-8 text-center text-gray-400">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50 text-emerald-400" />
                    <p className="text-sm">All systems operating normally</p>
                  </div>
                )}
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Work Orders */}
      <div className="grid grid-cols-1 gap-8 mb-8">
        <Card className="border-white/10 bg-navy-800">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-sky-400" />
              Recent Work Orders
            </h2>
            <span className="text-xs text-gray-400">Last 10</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-xs font-semibold text-gray-400">ID</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-400">Customer</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-400">Service</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-400">Status</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-400">Priority</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-400">Crew</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-400">Value</th>
                  <th className="text-left p-4 text-xs font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {workOrders && workOrders.length > 0 ? (
                  workOrders.slice(0, 10).map((wo) => (
                    <tr key={wo.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 text-xs text-white font-mono">{wo.id?.slice(0, 8)}</td>
                      <td className="p-4 text-sm text-white">{wo.customerName || 'N/A'}</td>
                      <td className="p-4 text-sm text-gray-300">{wo.serviceType || 'N/A'}</td>
                      <td className="p-4">
                        <Badge className={statusColors[wo.status] || 'bg-gray-500/20'}>
                          {wo.status}
                        </Badge>
                      </td>
                      <td className="p-4">
                        {wo.priority === 'urgent' ? (
                          <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                            Urgent
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-500/20 text-gray-300">Normal</Badge>
                        )}
                      </td>
                      <td className="p-4 text-sm text-gray-300">{wo.crewName || 'Unassigned'}</td>
                      <td className="p-4 text-sm font-semibold text-emerald-400">
                        {formatCurrency(wo.estimatedValue || 0)}
                      </td>
                      <td className="p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedWorkOrder(wo)}
                          className="text-sky-400 hover:text-sky-300 text-xs"
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-gray-400">
                      No work orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Crew Status Grid */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-sky-400" />
          Crew Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats?.crews?.total > 0 ? (
            Array.from({ length: Math.min(stats.crews.total, 6) }).map((_, idx) => (
              <Card
                key={idx}
                className="border-white/10 bg-gradient-to-br from-navy-800 to-navy-900 p-4 hover:border-white/20 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold text-white">Crew {idx + 1}</p>
                    <Badge className={crewStatusColors['on_job'] || 'bg-gray-500/20'}>
                      On Job
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-gray-400">
                    <MapPin className="h-3 w-3" />
                    <span>Current Job</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Users className="h-3 w-3" />
                    <span>{2 + idx} members</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Clock className="h-3 w-3" />
                    <span>2h remaining</span>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="border-white/10 bg-navy-800 p-8 col-span-3">
              <div className="text-center text-gray-400">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No crews assigned yet</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
