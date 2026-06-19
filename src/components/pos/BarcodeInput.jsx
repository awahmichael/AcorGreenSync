import { useRef, useState } from 'react';
import { Barcode, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Manual barcode entry fallback for when a hardware scanner is not available.
 * Hardware scanners work automatically via useBarcodeScanner hook in POS.
 */
export default function BarcodeInput({ onScan, lastScanned, onClear }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && value.trim().length >= 6) {
      e.preventDefault();
      onScan(value.trim());
      setValue('');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Scan or type UPC / EAN barcode..."
          className="pl-9 pr-3 font-mono text-sm"
        />
      </div>
      {lastScanned && (
        <div className={cn(
          "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap",
          lastScanned.found
            ? "bg-green-50 border-green-200 text-green-700"
            : "bg-red-50 border-red-200 text-red-700"
        )}>
          {lastScanned.found ? `✓ ${lastScanned.name}` : `✗ Not found: ${lastScanned.code}`}
          <button onClick={onClear} className="ml-1 opacity-60 hover:opacity-100">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}