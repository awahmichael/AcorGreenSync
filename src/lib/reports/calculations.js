// ===== FILTERING =====
export function filterByPeriod(items, days, dateField = 'transaction_date', dateRange = null) {
  if (dateRange) {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);
    return items.filter(item => {
      const d = item[dateField] || item.created_date;
      if (!d) return false;
      const date = new Date(d);
      return date >= start && date <= end;
    });
  }
  if (!days || days === 0) return items;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return items.filter(item => {
    const d = item[dateField] || item.created_date;
    return d && new Date(d) >= cutoff;
  });
}

// ===== GROUPING =====
export function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item) ?? 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

export function groupAndSum(items, keyFn, valueFn) {
  const groups = groupBy(items, keyFn);
  return Object.entries(groups).map(([key, group]) => ({
    key,
    value: group.reduce((s, i) => s + (valueFn(i) || 0), 0),
    count: group.length,
    items: group,
  }));
}

// ===== AGGREGATION =====
export function sum(items, fieldOrFn) {
  return items.reduce((s, item) => s + (typeof fieldOrFn === 'function' ? (fieldOrFn(item) || 0) : (item[fieldOrFn] || 0)), 0);
}

export function avg(items, fieldOrFn) {
  if (!items.length) return 0;
  return sum(items, fieldOrFn) / items.length;
}

export function count(items) {
  return items.length;
}

// ===== SORTING =====
export function sortByValue(items, valueFn, desc = true) {
  return [...items].sort((a, b) => {
    const diff = (valueFn(a) || 0) - (valueFn(b) || 0);
    return desc ? -diff : diff;
  });
}

export function topN(items, n, valueFn, desc = true) {
  return sortByValue(items, valueFn, desc).slice(0, n);
}

// ===== TIME HELPERS =====
export function getHour(date) { return new Date(date).getHours(); }

export function getDayName(date) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(date).getDay()];
}

export function getDateKey(date) {
  return new Date(date).toISOString().split('T')[0];
}

export function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getYear(date) { return new Date(date).getFullYear(); }

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ===== FORMATTING =====
export function formatCurrency(n) {
  return `£${(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCO2e(n) {
  if (!n) return '0.0000 kg';
  if (n >= 1000) return `${(n / 1000).toFixed(2)} t`;
  return `${n.toFixed(4)} kg`;
}

export function formatNumber(n) {
  return (n || 0).toLocaleString('en-GB');
}

export function formatPercent(n) {
  return `${(n || 0).toFixed(1)}%`;
}

// ===== CSV EXPORT =====
export function exportCSV(filename, headers, rows) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== TRANSACTION HELPERS =====
export function flattenItems(transactions) {
  const items = [];
  transactions.forEach(t => {
    (t.items || []).forEach(item => {
      items.push({
        ...item,
        transaction_ref: t.transaction_ref,
        transaction_date: t.transaction_date,
        store_id: t.store_id,
        store_name: t.store_name,
        cashier_id: t.cashier_id,
        cashier_name: t.cashier_name,
        customer_id: t.customer_id,
        customer_name: t.customer_name,
        payment_method: t.payment_method,
        discount_amount: t.discount_amount,
        total_amount: t.total_amount,
      });
    });
  });
  return items;
}

export function getItemRevenue(item) {
  return (item.unit_price || 0) * (item.quantity || 0);
}

// ===== CHART COLORS =====
export const CHART_COLORS = {
  primary: '#16A34A', secondary: '#86EFAC', blue: '#3B82F6',
  purple: '#A855F7', orange: '#F97316', pink: '#EC4899',
  teal: '#14B8A6', amber: '#F59E0B', red: '#EF4444', indigo: '#6366F1',
};

export const CHART_PALETTE = ['#16A34A', '#3B82F6', '#A855F7', '#F97316', '#EC4899', '#14B8A6', '#F59E0B', '#86EFAC', '#60A5FA', '#C084FC', '#FB923C', '#F472B6', '#5EEAD4', '#FCD34D'];