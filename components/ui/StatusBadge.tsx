type StatusBadgeProps = {
  status: 'todo' | 'done';
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const isDone = status === 'done';

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
        isDone
          ? 'bg-green-100 text-green-700'
          : 'bg-amber-100 text-amber-700'
      }`}
    >
      {isDone ? 'Faite' : 'À faire'}
    </span>
  );
}