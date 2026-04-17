/**
 * NewAssignmentsAlert
 *
 * Center-screen modal shown to a tester on login when they have one or more
 * assignments they have not yet viewed (tester_assignments.viewed_at IS NULL).
 *
 * Explains what was assigned, where to find the full task list, and how to
 * run through and log bugs on each task. Dismissing marks every unviewed
 * assignment as viewed so the alert does not re-trigger for the same batch.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { listUnviewedAssignments, markAssignmentsViewed } from '../lib/testerProgramService'
import { Bell, ListChecks, Bug, Clock, ArrowRight } from 'lucide-react'

const PRIORITY_STYLES = {
  urgent: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  low: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
}

export default function NewAssignmentsAlert({ userId }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [unviewed, setUnviewed] = useState([])
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listUnviewedAssignments(userId)
        if (cancelled) return
        if (rows.length > 0) {
          setUnviewed(rows)
          setOpen(true)
        }
      } catch (e) {
        // Non-fatal — the dashboard still renders without the alert
        console.error('NewAssignmentsAlert load failed', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const dismiss = async () => {
    setDismissing(true)
    try {
      await markAssignmentsViewed(unviewed.map((a) => a.id))
    } catch (e) {
      console.error('markAssignmentsViewed failed', e)
    } finally {
      setDismissing(false)
      setOpen(false)
    }
  }

  const goToTasks = async () => {
    await dismiss()
    // Tester dashboard is /admin — scroll to the My Assignments section is handled
    // by the dashboard itself. If already there, this is a no-op navigation.
    navigate('/admin')
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-full bg-sky-500/15 flex items-center justify-center">
              <Bell className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <DialogTitle className="text-xl text-slate-900 dark:text-slate-100">
                New tester tasks assigned
              </DialogTitle>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                You have {unviewed.length} new task{unviewed.length === 1 ? '' : 's'} to run through.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* How-to-test block */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <ListChecks className="h-5 w-5 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700 dark:text-slate-300">
              <div className="font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
                Where to find your tasks
              </div>
              Your full list with instructions lives on your dashboard at{' '}
              <span className="font-mono text-xs bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                /admin
              </span>{' '}
              under <span className="font-medium">My Assignments</span>. Click any task to see the
              step-by-step test steps.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700 dark:text-slate-300">
              <div className="font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
                Before you start
              </div>
              Clock in using the timer chip at the top of the page — your testing hours count toward
              your commission pool.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Bug className="h-5 w-5 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700 dark:text-slate-300">
              <div className="font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
                If you find a bug
              </div>
              Go to{' '}
              <span className="font-mono text-xs bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                /admin/testing
              </span>{' '}
              → <span className="font-medium">Work Log</span> tab and log it. Include the page URL,
              what you did, what you expected, and what actually happened. Screenshots help a ton.
              Critical bugs ping Ryan automatically.
            </div>
          </div>
        </div>

        {/* Assignment list */}
        <div className="mt-2">
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2 font-semibold">
            Your new tasks
          </div>
          <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {unviewed.map((a) => (
              <li
                key={a.id}
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {a.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase ${PRIORITY_STYLES[a.priority] || PRIORITY_STYLES.medium}`}
                    >
                      {a.priority}
                    </Badge>
                    {a.estimated_minutes && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        ~{a.estimated_minutes} min
                      </span>
                    )}
                  </div>
                  {a.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                      {a.description}
                    </p>
                  )}
                  {a.screen_path && (
                    <div className="text-[11px] font-mono text-sky-600 dark:text-sky-400 mt-1 truncate">
                      {a.screen_path}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
          <Button
            variant="outline"
            onClick={dismiss}
            disabled={dismissing}
            className="sm:w-auto w-full"
          >
            Got it — I'll review later
          </Button>
          <Button
            onClick={goToTasks}
            disabled={dismissing}
            className="bg-sky-500 hover:bg-sky-600 text-white sm:w-auto w-full"
          >
            Go to my tasks
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
