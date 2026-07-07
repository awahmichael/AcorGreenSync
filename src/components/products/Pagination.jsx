import { ChevronLeft, ChevronRight, ChevronsLeft } from 'lucide-react';

export default function Pagination({ currentPage, hasMore, totalItems, pageSize, loading, onPageChange, onPageSizeChange, pageSizeOptions = [100, 200, 300] }) {
  if (totalItems === 0 && !loading) return null;

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = (currentPage - 1) * pageSize + totalItems;
  const canPrev = currentPage > 1;
  const canNext = hasMore;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          {loading ? 'Loading...' : <>Showing <strong className="text-foreground">{startItem}</strong>–<strong className="text-foreground">{endItem}</strong> items</>}
        </span>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">Rows:</label>
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="text-xs border border-border rounded-md px-2 py-1 bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {pageSizeOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          disabled={!canPrev}
          onClick={() => onPageChange(1)}
          className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
          title="First page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>
        <button
          disabled={!canPrev}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs text-muted-foreground px-2">
          Page <strong className="text-foreground">{currentPage}</strong>
        </span>
        <button
          disabled={!canNext}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
          title="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}