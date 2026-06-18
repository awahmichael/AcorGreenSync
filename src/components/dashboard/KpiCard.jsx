import { cn } from '@/lib/utils';

const colorMap = {
  green: { bg: 'bg-green-50', icon: 'text-primary', border: 'border-green-100' },
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-100' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-100' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-100' },
};

export default function KpiCard({ title, value, subtitle, icon: Icon, color = 'green' }) {
  const c = colorMap[color] || colorMap.green;
  return (
    <div className={cn("bg-white rounded-xl border p-5 space-y-3", c.border)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", c.bg)}>
          <Icon className={cn("w-4 h-4", c.icon)} />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
      </div>
    </div>
  );
}