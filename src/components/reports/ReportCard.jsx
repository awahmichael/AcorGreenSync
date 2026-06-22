import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Printer, FileText } from 'lucide-react';
import { exportElementAsPDF, printElement } from '@/lib/reports/exportUtils';

export default function ReportCard({ title, description, onExport, children, className = '' }) {
  const contentRef = useRef(null);
  const safeName = title.replace(/\s+/g, '-').toLowerCase();

  const handlePDF = () => {
    if (contentRef.current) exportElementAsPDF(contentRef.current, `${safeName}.pdf`, title, description);
  };

  const handlePrint = () => {
    if (contentRef.current) printElement(contentRef.current, title, description);
  };

  return (
    <div className={`bg-white rounded-xl border border-border p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {onExport && (
            <Button variant="ghost" size="sm" onClick={onExport} className="text-xs h-7 px-2">
              <Download className="w-3 h-3 mr-1" /> CSV
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handlePrint} className="text-xs h-7 px-2">
            <Printer className="w-3 h-3 mr-1" /> Print
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePDF} className="text-xs h-7 px-2">
            <FileText className="w-3 h-3 mr-1" /> PDF
          </Button>
        </div>
      </div>
      <div ref={contentRef}>
        {children}
      </div>
    </div>
  );
}