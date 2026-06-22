import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export default function ReportCard({ title, description, onExport, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-border p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {onExport && (
          <Button variant="ghost" size="sm" onClick={onExport} className="text-xs h-7">
            <Download className="w-3 h-3 mr-1" /> CSV
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}