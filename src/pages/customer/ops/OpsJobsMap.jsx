import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOrg } from '../../../lib/OrgContext';
import { fetchWorkOrders, fetchCrews, fetchSchedule } from '../../../lib/customerOpsService';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';
import {
  MapPin,
  Truck,
  Navigation,
  ZoomIn,
  Filter,
  Eye,
  EyeOff,
  Zap,
  Clock,
  AlertCircle,
  Users,
  Maximize2,
  Layers,
  CheckCircle,
} from 'lucide-react';

const GOOGLE_MAPS_KEY = 'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8892b0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a4a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1a2b' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

const statusColors = {
  pending: '#eab308',    // yellow
  assigned: '#0ea5e9',   // blue
  in_progress: '#06b6d4', // cyan
  completed: '#22c55e',  // green
  urgent: '#ef4444',     // red
};

const getColorForStatus = (status) => statusColors[status] || '#94a3b8';

function OpsJobsMap() {
  const { currentOrg } = useOrg();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const crewMarkersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const polylineRef = useRef(null);

  const [workOrders, setWorkOrders] = useState([]);
  const [crews, setCrews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapsAPIFailed, setMapsAPIFailed] = useState(false);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [crewFilter, setCrewFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Map controls state
  const [showCrewLocations, setShowCrewLocations] = useState(true);
  const [showJobPins, setShowJobPins] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [satelliteView, setSatelliteView] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState([]);

  // Stats
  const [stats, setStats] = useState({ total: 0, urgent: 0, crews: 0 });

  // Load Google Maps script
  useEffect(() => {
    if (window.google?.maps) {
      setMapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places,geometry`;
    script.async = true;

    script.onload = () => {
      setMapLoaded(true);
    };

    script.onerror = () => {
      console.error('Failed to load Google Maps API');
      setMapsAPIFailed(true);
      setLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove script on unmount to avoid reload issues
    };
  }, []);

  // Fetch data
  useEffect(() => {
    if (!currentOrg?.id) return;

    const loadData = async () => {
      try {
        const [orders, crewList] = await Promise.all([
          fetchWorkOrders(currentOrg.id),
          fetchCrews(currentOrg.id),
        ]);

        setWorkOrders(orders || []);
        setCrews(crewList || []);

        const urgent = (orders || []).filter((o) => o.priority === 'urgent').length;
        setStats({
          total: orders?.length || 0,
          urgent,
          crews: crewList?.length || 0,
        });
      } catch (error) {
        console.error('Failed to load ops data:', error);
        toast.error('Failed to load work orders and crews');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentOrg?.id]);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstanceRef.current) return;

    try {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        zoom: 12,
        center: { lat: 40.7128, lng: -74.006 }, // NYC default
        mapTypeId: satelliteView ? 'satellite' : 'roadmap',
        styles: darkMapStyles,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      infoWindowRef.current = new window.google.maps.InfoWindow();
    } catch (error) {
      console.error('Failed to initialize map:', error);
      setMapsAPIFailed(true);
    }
  }, [mapLoaded]);

  // Update map type
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setMapTypeId(
      satelliteView ? 'satellite' : 'roadmap'
    );
  }, [satelliteView]);

  // Create marker SVG
  const createMarkerSvg = (status, isCrew = false) => {
    const color = getColorForStatus(status);
    const size = isCrew ? 30 : 40;

    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
          </filter>
        </defs>
        <circle cx="20" cy="20" r="18" fill="${color}" opacity="0.9" filter="url(#shadow)"/>
        <circle cx="20" cy="20" r="16" fill="${color}" opacity="0.2"/>
        ${isCrew ? `<text x="20" y="24" text-anchor="middle" font-size="18" fill="white" font-weight="bold">🚚</text>` : `<text x="20" y="26" text-anchor="middle" font-size="20" fill="white" font-weight="bold">📍</text>`}
      </svg>
    `;

    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  // Plot job markers
  useEffect(() => {
    if (!mapInstanceRef.current || !showJobPins) {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      return;
    }

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const filteredOrders = workOrders.filter((wo) => {
      if (statusFilter !== 'all' && wo.status !== statusFilter) return false;
      if (crewFilter !== 'all' && wo.assigned_crew_id !== crewFilter) return false;
      if (priorityFilter !== 'all' && wo.priority !== priorityFilter) return false;
      return !!(wo.lat && wo.lng);
    });

    filteredOrders.forEach((wo) => {
      const marker = new window.google.maps.Marker({
        position: { lat: parseFloat(wo.lat), lng: parseFloat(wo.lng) },
        map: mapInstanceRef.current,
        title: wo.title,
        icon: {
          url: createMarkerSvg(wo.status),
          scaledSize: new window.google.maps.Size(40, 40),
          anchor: new window.google.maps.Point(20, 40),
        },
      });

      marker.addListener('click', () => {
        const crew = crews.find((c) => c.id === wo.assigned_crew_id);
        const infoContent = `
          <div style="color: #1a1a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 12px; max-width: 280px;">
            <div style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">WO #${wo.number}</div>
            <div style="font-size: 13px; margin-bottom: 6px;"><strong>${wo.title}</strong></div>
            <div style="font-size: 12px; color: #475569; margin-bottom: 6px;">${wo.customer_name}</div>
            <div style="font-size: 12px; color: #475569; margin-bottom: 8px;">📍 ${wo.address}</div>
            <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
              <span style="background: ${getColorForStatus(wo.status)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                ${wo.status.toUpperCase()}
              </span>
              ${wo.priority === 'urgent' ? '<span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">URGENT</span>' : ''}
            </div>
            ${crew ? `<div style="font-size: 12px; margin-bottom: 6px;"><strong>Crew:</strong> ${crew.name}</div>` : ''}
            ${wo.scheduled_time ? `<div style="font-size: 12px;"><strong>Time:</strong> ${new Date(wo.scheduled_time).toLocaleTimeString()}</div>` : ''}
          </div>
        `;

        infoWindowRef.current.setContent(infoContent);
        infoWindowRef.current.open(mapInstanceRef.current, marker);
      });

      markersRef.current.push(marker);
    });
  }, [workOrders, showJobPins, statusFilter, crewFilter, priorityFilter, crews]);

  // Plot crew markers
  useEffect(() => {
    if (!mapInstanceRef.current || !showCrewLocations) {
      crewMarkersRef.current.forEach((m) => m.setMap(null));
      crewMarkersRef.current = [];
      return;
    }

    crewMarkersRef.current.forEach((m) => m.setMap(null));
    crewMarkersRef.current = [];

    crews.forEach((crew) => {
      if (!crew.current_lat || !crew.current_lng) return;

      const marker = new window.google.maps.Marker({
        position: { lat: parseFloat(crew.current_lat), lng: parseFloat(crew.current_lng) },
        map: mapInstanceRef.current,
        title: crew.name,
        icon: {
          url: createMarkerSvg('assigned', true),
          scaledSize: new window.google.maps.Size(30, 30),
          anchor: new window.google.maps.Point(15, 30),
        },
      });

      marker.addListener('click', () => {
        const infoContent = `
          <div style="color: #1a1a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 12px; max-width: 200px;">
            <div style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">🚚 ${crew.name}</div>
            <div style="font-size: 12px; margin-bottom: 8px;"><strong>Status:</strong> ${crew.status || 'tracking'}</div>
            ${crew.current_jobs ? `<div style="font-size: 12px;">Jobs: ${crew.current_jobs}</div>` : ''}
          </div>
        `;

        infoWindowRef.current.setContent(infoContent);
        infoWindowRef.current.open(mapInstanceRef.current, marker);
      });

      crewMarkersRef.current.push(marker);
    });
  }, [crews, showCrewLocations]);

  // Fit all markers in view
  const fitAllMarkers = useCallback(() => {
    if (!mapInstanceRef.current || (markersRef.current.length === 0 && crewMarkersRef.current.length === 0)) {
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    [...markersRef.current, ...crewMarkersRef.current].forEach((marker) => {
      bounds.extend(marker.getPosition());
    });

    mapInstanceRef.current.fitBounds(bounds);
  }, []);

  // Draw route
  const optimizeRoute = useCallback(() => {
    if (selectedJobs.length < 2) {
      toast.error('Select at least 2 jobs to optimize route');
      return;
    }

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    const selectedWOs = workOrders.filter((wo) => selectedJobs.includes(wo.id));
    const path = selectedWOs.map((wo) => ({
      lat: parseFloat(wo.lat),
      lng: parseFloat(wo.lng),
    }));

    polylineRef.current = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#0ea5e9',
      strokeOpacity: 0.8,
      strokeWeight: 3,
      map: mapInstanceRef.current,
    });

    // Calculate distance and time
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = new window.google.maps.LatLng(path[i].lat, path[i].lng);
      const p2 = new window.google.maps.LatLng(path[i + 1].lat, path[i + 1].lng);
      totalDistance += window.google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
    }

    const miles = (totalDistance * 0.000621371).toFixed(1);
    const estimatedMinutes = Math.ceil((totalDistance / 1000 / 80) * 60); // ~80 km/h average

    toast.success(`Route optimized: ${miles} mi, ~${estimatedMinutes} min drive time`);
  }, [selectedJobs, workOrders]);

  // Clear route
  const clearRoute = useCallback(() => {
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    setSelectedJobs([]);
  }, []);

  // Fallback UI when Google Maps fails
  if (mapsAPIFailed) {
    return (
      <div className="h-full bg-navy-900 text-white p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Jobs Map</h1>
          <p className="text-white/60">Real-time dispatch visualization</p>
        </div>

        <Card className="bg-yellow-900/20 border-yellow-500/30 p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-yellow-200">Google Maps API Key Required</div>
              <p className="text-yellow-100/70 text-sm mt-1">
                Add your Google Maps API key in Settings to enable the interactive map and real-time tracking.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {workOrders.map((wo) => (
            <Card key={wo.id} className="bg-navy-800 border-white/10 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-white">WO #{wo.number}</div>
                  <div className="text-sm text-white/60 mt-1">{wo.title}</div>
                </div>
                <Badge className={`${getColorForStatus(wo.status)} text-white`}>
                  {wo.status}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-white/70">
                  <MapPin className="w-4 h-4" />
                  <span>{wo.address}</span>
                </div>

                {wo.assigned_crew_id && (
                  <div className="flex items-center gap-2 text-white/70">
                    <Truck className="w-4 h-4" />
                    <span>{crews.find((c) => c.id === wo.assigned_crew_id)?.name || 'Unassigned'}</span>
                  </div>
                )}

                {wo.scheduled_time && (
                  <div className="flex items-center gap-2 text-white/70">
                    <Clock className="w-4 h-4" />
                    <span>{new Date(wo.scheduled_time).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="mt-4 w-full text-sky-500 hover:text-sky-400 hover:bg-sky-500/10"
                onClick={() => {
                  const encoded = encodeURIComponent(wo.address);
                  window.open(`https://maps.google.com/?q=${encoded}`, '_blank');
                }}
              >
                <MapPin className="w-4 h-4 mr-2" />
                View in Google Maps
              </Button>
            </Card>
          ))}
        </div>

        {workOrders.length === 0 && (
          <Card className="bg-navy-800 border-white/10 p-8 text-center">
            <div className="text-white/60">No work orders found</div>
          </Card>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full bg-navy-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-sky-500 border-t-transparent mx-auto mb-4" />
          <p>Loading dispatch data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-navy-900 flex overflow-hidden">
      {/* Left Sidebar */}
      {sidebarOpen && (
        <div className="w-80 bg-navy-800 border-r border-white/10 flex flex-col shadow-lg">
          {/* Header */}
          <div className="p-4 border-b border-white/10">
            <h2 className="text-lg font-bold text-white mb-3">Dispatch</h2>

            {/* Filters */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-white/60 block mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-navy-700 border border-white/10 rounded px-2 py-1.5 text-white text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/60 block mb-2">Crew</label>
                <select
                  value={crewFilter}
                  onChange={(e) => setCrewFilter(e.target.value)}
                  className="w-full bg-navy-700 border border-white/10 rounded px-2 py-1.5 text-white text-sm"
                >
                  <option value="all">All Crews</option>
                  {crews.map((crew) => (
                    <option key={crew.id} value={crew.id}>
                      {crew.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/60 block mb-2">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full bg-navy-700 border border-white/10 rounded px-2 py-1.5 text-white text-sm"
                >
                  <option value="all">All Priorities</option>
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
          </div>

          {/* Job List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-3 space-y-2">
              {workOrders
                .filter((wo) => {
                  if (statusFilter !== 'all' && wo.status !== statusFilter) return false;
                  if (crewFilter !== 'all' && wo.assigned_crew_id !== crewFilter) return false;
                  if (priorityFilter !== 'all' && wo.priority !== priorityFilter) return false;
                  return true;
                })
                .map((wo) => (
                  <div
                    key={wo.id}
                    onClick={() => {
                      if (selectedJobs.includes(wo.id)) {
                        setSelectedJobs(selectedJobs.filter((id) => id !== wo.id));
                      } else {
                        setSelectedJobs([...selectedJobs, wo.id]);
                      }
                    }}
                    className={`p-3 rounded border cursor-pointer transition ${
                      selectedJobs.includes(wo.id)
                        ? 'bg-sky-500/20 border-sky-500'
                        : 'bg-navy-700/50 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-white text-sm">WO #{wo.number}</div>
                        <div className="text-xs text-white/70 mt-0.5 line-clamp-1">{wo.title}</div>
                      </div>
                      {selectedJobs.includes(wo.id) && (
                        <CheckCircle className="w-4 h-4 text-sky-500 flex-shrink-0 mt-0.5" />
                      )}
                    </div>

                    <div className="flex gap-2 mb-2 flex-wrap">
                      <Badge className={`${getColorForStatus(wo.status)} text-white text-xs`}>
                        {wo.status}
                      </Badge>
                      {wo.priority === 'urgent' && (
                        <Badge className="bg-red-500/80 text-white text-xs">Urgent</Badge>
                      )}
                    </div>

                    <div className="text-xs text-white/60 line-clamp-1">{wo.address}</div>

                    {wo.assigned_crew_id && (
                      <div className="text-xs text-white/60 mt-1">
                        {crews.find((c) => c.id === wo.assigned_crew_id)?.name || 'Unassigned'}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Crew Status */}
          <div className="border-t border-white/10 p-4">
            <h3 className="text-xs font-semibold text-white/60 mb-3">CREW STATUS</h3>
            <div className="space-y-2">
              {crews.map((crew) => (
                <div key={crew.id} className="flex items-center justify-between p-2 bg-navy-700/30 rounded">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${crew.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-xs text-white">{crew.name}</span>
                  </div>
                  <span className="text-xs text-white/50">{crew.status || 'idle'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />

        {/* Stats Overlay */}
        <div className="absolute top-4 right-4 z-10">
          <Card className="bg-navy-800/95 border-white/10 p-4 backdrop-blur-sm">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-xs text-white/60">Total Jobs</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-500">{stats.urgent}</div>
                <div className="text-xs text-white/60">Urgent</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{stats.crews}</div>
                <div className="text-xs text-white/60">Crews</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Map Controls */}
        <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="bg-navy-800/95 border border-white/10 text-white hover:bg-navy-700 hover:text-sky-400"
            onClick={fitAllMarkers}
            title="Fit all markers"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={`bg-navy-800/95 border border-white/10 text-white hover:bg-navy-700 ${
              showJobPins ? 'text-sky-400' : 'text-white/50'
            }`}
            onClick={() => setShowJobPins(!showJobPins)}
            title="Toggle job pins"
          >
            {showJobPins ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={`bg-navy-800/95 border border-white/10 text-white hover:bg-navy-700 ${
              showCrewLocations ? 'text-sky-400' : 'text-white/50'
            }`}
            onClick={() => setShowCrewLocations(!showCrewLocations)}
            title="Toggle crew locations"
          >
            <Truck className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={`bg-navy-800/95 border border-white/10 text-white hover:bg-navy-700 ${
              satelliteView ? 'text-sky-400' : 'text-white/50'
            }`}
            onClick={() => setSatelliteView(!satelliteView)}
            title="Toggle satellite view"
          >
            <Layers className="w-4 h-4" />
          </Button>
        </div>

        {/* Route Optimizer */}
        {selectedJobs.length > 0 && (
          <div className="absolute bottom-6 right-6 z-10">
            <Card className="bg-navy-800/95 border-white/10 p-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <Navigation className="w-4 h-4 text-sky-500" />
                <span className="text-sm font-semibold text-white">{selectedJobs.length} jobs selected</span>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-sky-500 hover:bg-sky-600 text-white"
                  onClick={optimizeRoute}
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Optimize Route
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="bg-navy-700 hover:bg-navy-600 text-white"
                  onClick={clearRoute}
                >
                  Clear
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 left-4 z-10 p-2 bg-navy-800/95 border border-white/10 rounded text-white hover:bg-navy-700 transition"
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export default OpsJobsMap;
