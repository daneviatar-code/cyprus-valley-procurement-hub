import { Status } from '@/data/projectData';

const statusStyles: Record<string, string> = {
  '': 'bg-muted text-muted-foreground',
  'Pending': 'bg-status-pending/15 text-status-pending',
  'Ordered': 'bg-status-ordered/15 text-status-ordered',
  'Delivered': 'bg-status-delivered/15 text-status-delivered',
  'Issue': 'bg-status-issue/15 text-status-issue',
};

export default function StatusBadge({ status }: { status: Status }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}>
      {status}
    </span>
  );
}
