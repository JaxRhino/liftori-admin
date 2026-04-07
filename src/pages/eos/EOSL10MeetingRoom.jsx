import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Check,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import {
  fetchMeeting,
  startMeeting,
  completeMeeting,
  fetchRocks,
  fetchTodos,
  fetchIssues,
  fetchScorecardMetrics,
  fetchHeadlines,
} from '../../lib/eosService';

const SECTIONS = [
  { id: 0, name: 'Segue', duration: 5 },
  { id: 1, name: 'Scorecard Review', duration: 10 },
  { id: 2, name: 'Rock Review', duration: 5 },
  { id: 3, name: 'Headlines', duration: 5 },
  { id: 4, name: 'To-Do Review', duration: 5 },
  { id: 5, name: 'IDS', duration: 60 },
  { id: 6, name: 'Conclude', duration: 5 },
];

export default function EOSL10MeetingRoom() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState(null);
  const [rocks, setRocks] = useState([]);
  const [todos, setTodos] = useState([]);
  const [issues, setIssues] = useState([]);
  const [scorecard, setScorecard] = useState([]);
  const [headlines, setHeadlines] = useState([]);

  const [currentSection, setCurrentSection] = useState(0);
  const [sectionTimeLeft, setSectionTimeLeft] = useState(SECTIONS[0].duration * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const [segueNotes, setSegueNotes] = useState('');
  const [concludeNotes, setConcludeNotes] = useState('');
  const [completedTodos, setCompletedTodos] = useState(new Set());

  useEffect(() => {
    loadMeetingData();
  }, [meetingId]);

  const loadMeetingData = async () => {
    try {
      setLoading(true);
      const [
        meetingData,
        rocksData,
        todosData,
        issuesData,
        scorecardData,
        headlinesData,
      ] = await Promise.all([
        fetchMeeting(meetingId),
        fetchRocks(),
        fetchTodos(),
        fetchIssues(),
        fetchScorecardMetrics(),
        fetchHeadlines(),
      ]);

      setMeeting(meetingData);
      setRocks(rocksData || []);
      setTodos(todosData || []);
      setIssues(issuesData || []);
      setScorecard(scorecardData || []);
      setHeadlines(headlinesData || []);
    } catch (error) {
      console.error('Error loading meeting data:', error);
      toast.error('Failed to load meeting');
      navigate('/eos/l10-meetings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval;
    if (timerRunning && sectionTimeLeft > 0) {
      interval = setInterval(() => {
        setSectionTimeLeft((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            toast.info(`${SECTIONS[currentSection].name} time is up!`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, sectionTimeLeft, currentSection]);

  const handleStartMeeting = async () => {
    try {
      await startMeeting(meetingId);
      toast.success('Meeting started');
      setTimerRunning(true);
    } catch (error) {
      console.error('Error starting meeting:', error);
      toast.error('Failed to start meeting');
    }
  };

  const handleCompleteMeeting = async () => {
    try {
      await completeMeeting(meetingId, {
        notes: concludeNotes,
      });
      toast.success('Meeting completed');
      navigate('/eos/l10-meetings');
    } catch (error) {
      console.error('Error completing meeting:', error);
      toast.error('Failed to complete meeting');
    }
  };

  const goToSection = (sectionId) => {
    setCurrentSection(sectionId);
    setSectionTimeLeft(SECTIONS[sectionId].duration * 60);
    setTimerRunning(false);
  };

  const goToPreviousSection = () => {
    if (currentSection > 0) {
      goToSection(currentSection - 1);
    }
  };

  const goToNextSection = () => {
    if (currentSection < SECTIONS.length - 1) {
      goToSection(currentSection + 1);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderSectionContent = () => {
    const section = SECTIONS[currentSection];

    switch (currentSection) {
      case 0: // Segue
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Good news and personal wins from each attendee</p>
            <Textarea
              placeholder="Record positive updates and wins from the team..."
              value={segueNotes}
              onChange={(e) => setSegueNotes(e.target.value)}
              className="bg-navy-800 border-navy-700 text-white min-h-48"
            />
          </div>
        );

      case 1: // Scorecard Review
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Review key metrics and KPIs</p>
            {scorecard.length === 0 ? (
              <p className="text-gray-400">No scorecard metrics available</p>
            ) : (
              <div className="space-y-3">
                {scorecard.map((metric) => (
                  <Card key={metric.id} className="bg-navy-800 border-navy-700 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-white">{metric.name}</h4>
                        <p className="text-2xl font-bold text-blue-400 mt-1">{metric.value}</p>
                      </div>
                      <Badge
                        className={metric.status === 'on_track' ? 'bg-green-600' : 'bg-red-600'}
                      >
                        {metric.status === 'on_track' ? 'On Track' : 'Off Track'}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case 2: // Rock Review
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Quarterly Rocks (90-day goals)</p>
            {rocks.length === 0 ? (
              <p className="text-gray-400">No rocks assigned</p>
            ) : (
              <div className="space-y-3">
                {rocks.map((rock) => (
                  <Card key={rock.id} className="bg-navy-800 border-navy-700 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-white">{rock.title}</h4>
                        <p className="text-sm text-gray-400 mt-1">{rock.owner}</p>
                      </div>
                      <Badge
                        className={
                          rock.status === 'completed'
                            ? 'bg-green-600'
                            : rock.status === 'on_track'
                              ? 'bg-blue-600'
                              : 'bg-yellow-600'
                        }
                      >
                        {rock.status || 'Not Started'}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case 3: // Headlines
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Key updates and news</p>
            {headlines.length === 0 ? (
              <p className="text-gray-400">No headlines</p>
            ) : (
              <div className="space-y-3">
                {headlines.map((headline) => (
                  <Card key={headline.id} className="bg-navy-800 border-navy-700 p-4">
                    <h4 className="font-medium text-white">{headline.title}</h4>
                    {headline.description && (
                      <p className="text-sm text-gray-400 mt-2">{headline.description}</p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case 4: // To-Do Review
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Review open to-dos from last meeting</p>
            {todos.length === 0 ? (
              <p className="text-gray-400">No to-dos</p>
            ) : (
              <div className="space-y-2">
                {todos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center gap-3 bg-navy-800 border border-navy-700 rounded-lg p-3"
                  >
                    <input
                      type="checkbox"
                      checked={completedTodos.has(todo.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCompletedTodos(new Set([...completedTodos, todo.id]));
                        } else {
                          const newSet = new Set(completedTodos);
                          newSet.delete(todo.id);
                          setCompletedTodos(newSet);
                        }
                      }}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                    <span
                      className={`flex-1 ${completedTodos.has(todo.id) ? 'line-through text-gray-500' : 'text-white'}`}
                    >
                      {todo.title}
                    </span>
                    <span className="text-xs text-gray-400">{todo.owner}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 5: // IDS
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Identify, Discuss, Solve issues</p>
            {issues.length === 0 ? (
              <p className="text-gray-400">No issues</p>
            ) : (
              <div className="space-y-3">
                {issues.map((issue) => (
                  <Card key={issue.id} className="bg-navy-800 border-navy-700 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-white flex-1">{issue.title}</h4>
                      <Badge
                        className={
                          issue.status === 'solved'
                            ? 'bg-green-600'
                            : issue.status === 'discussing'
                              ? 'bg-blue-600'
                              : 'bg-gray-600'
                        }
                      >
                        {issue.status || 'New'}
                      </Badge>
                    </div>
                    {issue.description && (
                      <p className="text-sm text-gray-400">{issue.description}</p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case 6: // Conclude
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Meeting recap and next steps</p>
            <Textarea
              placeholder="Summary of decisions, action items, and next week's priorities..."
              value={concludeNotes}
              onChange={(e) => setConcludeNotes(e.target.value)}
              className="bg-navy-800 border-navy-700 text-white min-h-48"
            />
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy-950">
        <p className="text-gray-400">Loading meeting...</p>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy-950">
        <p className="text-gray-400">Meeting not found</p>
      </div>
    );
  }

  const currentSectionData = SECTIONS[currentSection];

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => navigate('/eos/l10-meetings')}
            variant="outline"
            className="mb-4 border-navy-700 text-gray-400"
          >
            ← Back to Meetings
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">{meeting.title}</h1>
              <p className="text-gray-400 mt-2">Section {currentSection + 1} of {SECTIONS.length}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm">Time Left</p>
              <p className="text-4xl font-bold text-blue-400 font-mono">
                {formatTime(sectionTimeLeft)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Section Navigation */}
          <div className="lg:col-span-1">
            <Card className="bg-navy-900 border-navy-800 p-4 sticky top-8">
              <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase">Sections</h3>
              <div className="space-y-2">
                {SECTIONS.map((section, idx) => (
                  <button
                    key={section.id}
                    onClick={() => goToSection(section.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      idx === currentSection
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:bg-navy-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{section.name}</span>
                      {idx < currentSection && <Check className="w-4 h-4" />}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Section Content */}
            <Card className="bg-navy-900 border-navy-800 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">{currentSectionData.name}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">{currentSectionData.duration} min</span>
                  <Button
                    onClick={() => setTimerRunning(!timerRunning)}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {timerRunning ? (
                      <>
                        <Pause className="w-3 h-3 mr-1" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 mr-1" />
                        Start
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {renderSectionContent()}
            </Card>

            {/* Navigation and Actions */}
            <div className="flex gap-2 justify-between">
              <Button
                onClick={goToPreviousSection}
                disabled={currentSection === 0}
                variant="outline"
                className="border-navy-700 text-gray-400 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>

              <div className="flex gap-2">
                {meeting.status === 'scheduled' && (
                  <Button
                    onClick={handleStartMeeting}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Start Meeting
                  </Button>
                )}
                {currentSection === SECTIONS.length - 1 && meeting.status === 'in_progress' && (
                  <Button
                    onClick={handleCompleteMeeting}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Complete Meeting
                  </Button>
                )}
              </div>

              <Button
                onClick={goToNextSection}
                disabled={currentSection === SECTIONS.length - 1}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
