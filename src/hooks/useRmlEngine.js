import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

// In-memory cache for RML factor lookups (edge-first pattern)
let factorCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min refresh

export function useRmlEngine() {
  const [factors, setFactors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFactors();
  }, []);

  const loadFactors = async () => {
    const now = Date.now();
    if (factorCache && (now - cacheTimestamp) < CACHE_TTL) {
      setFactors(factorCache);
      setLoading(false);
      return;
    }
    const data = await base44.entities.EmissionFactor.filter({ is_active: true });
    factorCache = data;
    cacheTimestamp = now;
    setFactors(data);
    setLoading(false);
  };

  // Exact match on commodity_code
  const resolveByCode = useCallback((commodityCode) => {
    if (!commodityCode || !factors.length) return null;
    const code = commodityCode.trim().toUpperCase();
    return factors.find(f =>
      f.commodity_code && f.commodity_code.trim().toUpperCase() === code
    ) || factors.find(f =>
      f.commodity_code && f.commodity_code.trim().toUpperCase().startsWith(code)
    ) || null;
  }, [factors]);

  // Fuzzy match on category name
  const resolveByCategory = useCallback((category) => {
    if (!category || !factors.length) return null;
    const cat = category.toLowerCase();
    return factors.find(f =>
      f.category && f.category.toLowerCase().includes(cat)
    ) || factors.find(f =>
      f.name && f.name.toLowerCase().includes(cat)
    ) || null;
  }, [factors]);

  // Full RML resolution: code → category fallback
  const resolve = useCallback((commodityCode, category) => {
    const byCode = resolveByCode(commodityCode);
    if (byCode) return { factor: byCode, matchType: 'commodity_code' };
    const byCat = resolveByCategory(category);
    if (byCat) return { factor: byCat, matchType: 'category' };
    return null;
  }, [resolveByCode, resolveByCategory]);

  return { resolve, resolveByCode, resolveByCategory, factors, loading, refreshCache: loadFactors };
}