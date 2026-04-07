// Utility function for merging class names (lightweight clsx alternative)
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
