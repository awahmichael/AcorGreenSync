export default function ReportTable({ headers, rows, maxHeight = 'none' }) {
  return (
    <div className="overflow-auto" style={maxHeight !== 'none' ? { maxHeight } : {}}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {headers.map((h, i) => (
              <th key={i} className={`px-3 py-2 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap ${i === 0 ? 'text-left' : 'text-right'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length > 0 ? rows.map((row, i) => (
            <tr key={i} className="hover:bg-muted/20">
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-2 whitespace-nowrap ${j === 0 ? 'text-left font-medium' : 'text-right'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          )) : (
            <tr><td colSpan={headers.length} className="px-3 py-6 text-center text-muted-foreground text-xs">No data for this period.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}