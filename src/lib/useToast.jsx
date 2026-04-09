import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Shared toast notification hook with proper cleanup.
 * Prevents memory leaks from setTimeout on unmounted components.
 *
 * Usage:
 *   const { toast, showToast, ToastContainer } = useToast();
 *   showToast('Something happened', 'success');
 *   // In JSX: <ToastContainer />
 */
export function useToast(duration = 4000) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Auto-dismiss when toast changes
  useEffect(() => {
    if (!toast) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast, duration]);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
  }, []);

  // Render helper — drop this into JSX
  const ToastContainer = useCallback(() => {
    if (!toast) return null;
    const bgColor =
      toast.type === 'success' ? 'bg-emerald-600' :
      toast.type === 'error' ? 'bg-red-600' :
      'bg-sky-600';
    return (
      <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${bgColor}`}>
        {toast.message}
      </div>
    );
  }, [toast]);

  return { toast, showToast, ToastContainer };
}
