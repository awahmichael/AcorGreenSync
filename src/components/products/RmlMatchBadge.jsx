import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function RmlMatchBadge({ result, loading }) {
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading DEFRA factor cache...
      </div>
    );
  }

  if (!result) return null;

  const { factor, matchType } = result;

  const labels = {
    commodity_code: 'Exact commodity code match',
    category: 'Category-based match',
    manual_select: 'Manually selected',
  };

  return (
    <div className="flex items-center gap-1.5 text-xs mt-1">
      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
      <span className="text-green-700 font-medium">
        {labels[matchType] || 'Matched'}: {factor.name}
      </span>
      <span className="text-muted-foreground">
        ({factor.kg_co2e_per_unit} kg CO₂e/{factor.unit})
      </span>
    </div>
  );
}