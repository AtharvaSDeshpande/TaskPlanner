import { format, formatDistanceToNowStrict, isPast, differenceInHours } from 'date-fns';

export const formatDateTime = (d) => format(new Date(d), 'd MMM yyyy, h:mm a');
export const formatDate = (d) => format(new Date(d), 'd MMM yyyy');

// Formats a date for a native <input type="date"> (yyyy-MM-dd); '' when empty.
export const toDateInputValue = (d) => (d ? format(new Date(d), 'yyyy-MM-dd') : '');

// Returns a relative label, a MUI colour, and urgency flags for a deadline.
//   urgent → overdue or due within 24h   (flagged in red)
//   soon   → due within 72h               (warning)
export function deadlineMeta(dueAt) {
  const date = new Date(dueAt);
  const overdue = isPast(date);
  const hours = differenceInHours(date, new Date());
  const urgent = overdue || hours <= 24;
  const soon = !overdue && hours > 24 && hours <= 72;
  const color = urgent ? 'error' : soon ? 'warning' : 'success';
  const label = overdue
    ? `Overdue · ${formatDistanceToNowStrict(date)} ago`
    : `Due in ${formatDistanceToNowStrict(date)}`;
  return { label, color, overdue, urgent, soon };
}

// Comparator that orders items by soonest due date first; items without a due
// date sort to the end. Pass an accessor to read the date off each item.
export function byDeadline(getDue = (x) => x) {
  return (a, b) => {
    const da = getDue(a);
    const db = getDue(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return new Date(da).getTime() - new Date(db).getTime();
  };
}

export const initials = (name = '') =>
  name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const roleLabel = (role) =>
  ({ owner: 'Owner', admin: 'Administrator', moderator: 'Moderator', student: 'Student' }[role] ||
  role);
