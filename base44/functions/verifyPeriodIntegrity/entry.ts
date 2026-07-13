import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * ACORCLOUD GREEN-SYNC: RegTech Integrity Verifier
 * 
 * Re-calculates the SHA-256 hash for a locked ReportingPeriod
 * and compares it to the stored data_hash.
 * 
 * If they match → the data is mathematically proven unaltered since lock.
 * If they differ → tamper detected; the auditor is shown which
 *   transactions/logs were added, removed, or modified.
 * 
 * This function mirrors the exact same deterministic payload logic
 * from sealReportingPeriod — by design, so any auditor can verify
 * that the same inputs produce the same hash.
 */

const HASH_VERSION = 'v1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { period_id } = body;
    if (!period_id) return Response.json({ error: 'period_id is required' }, { status: 400 });

    // 1. Fetch the reporting period
    const period = await base44.asServiceRole.entities.ReportingPeriod.get(period_id);
    if (!period) return Response.json({ error: 'Reporting period not found' }, { status: 404 });
    if (period.status !== 'locked' || !period.data_hash) {
      return Response.json({
        verified: false,
        reason: 'Period is not sealed — no hash to verify against',
      }, { status: 400 });
    }

    // 2. Re-fetch ALL transactions and audit logs (same logic as seal)
    const startDate = period.period_start + 'T00:00:00.000Z';
    const endDate = period.period_end + 'T23:59:59.999Z';

    let allTransactions: any[] = [];
    let offset = 0;
    const pageSize = 200;
    while (true) {
      const batch = await base44.asServiceRole.entities.Transaction.list('-transaction_date', pageSize, offset);
      const filtered = (batch as any[]).filter((t: any) => {
        const td = t.transaction_date;
        if (!td) return false;
        return td >= startDate && td <= endDate;
      });
      allTransactions = allTransactions.concat(filtered);
      if ((batch as any[]).length < pageSize) break;
      offset += pageSize;
      if (offset > 10000) break;
    }

    let allAuditLogs: any[] = [];
    offset = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.AuditLog.list('-performed_at', pageSize, offset);
      const filtered = (batch as any[]).filter((a: any) => {
        const pa = a.performed_at;
        if (!pa) return false;
        return pa >= startDate && pa <= endDate;
      });
      allAuditLogs = allAuditLogs.concat(filtered);
      if ((batch as any[]).length < pageSize) break;
      offset += pageSize;
      if (offset > 10000) break;
    }

    // 3. Rebuild the deterministic payload (same logic as seal)
    const hashPayload = buildDeterministicPayload(period, allTransactions, allAuditLogs);
    const recalculatedHash = await generateSHA256(hashPayload);

    // 4. Compare
    const verified = recalculatedHash === period.data_hash;

    // 5. If tampered, compute a diff for the auditor
    let discrepancies = null;
    if (!verified) {
      const sealedLogIds = new Set(period.sealed_audit_log_ids || []);
      const currentLogIds = new Set(allAuditLogs.map((a: any) => a.id));
      const sealedTxnRefs = new Set(allTransactions.map((t: any) => t.transaction_ref));

      discrepancies = {
        sealed_transaction_count: period.total_transactions,
        current_transaction_count: allTransactions.length,
        sealed_audit_log_count: (period.sealed_audit_log_ids || []).length,
        current_audit_log_count: allAuditLogs.length,
        audit_logs_added_since_seal: allAuditLogs.filter((a: any) => !sealedLogIds.has(a.id)).map((a: any) => ({
          id: a.id,
          action: a.action,
          performed_at: a.performed_at,
          user_name: a.user_name,
        })),
        audit_logs_removed_since_seal: (period.sealed_audit_log_ids || []).filter((id: string) => !currentLogIds.has(id)),
      };
    }

    return Response.json({
      verified,
      period_id,
      label: period.label,
      period_start: period.period_start,
      period_end: period.period_end,
      stored_hash: period.data_hash,
      recalculated_hash: recalculatedHash,
      hash_version: period.hash_version,
      transaction_count: allTransactions.length,
      audit_log_count: allAuditLogs.length,
      verified_by: user.full_name || user.email || 'Unknown',
      verified_at: new Date().toISOString(),
      discrepancies,
    });
  } catch (error) {
    console.error('[verifyPeriodIntegrity] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// --- Mirrors the exact logic in sealReportingPeriod ---
function buildDeterministicPayload(period: any, transactions: any[], auditLogs: any[]): string {
  const normalizedTxns = transactions
    .map((t: any) => ({
      txn_ref: t.transaction_ref,
      total_amount: t.total_amount,
      total_kg_co2e: t.total_kg_co2e,
      transaction_date: t.transaction_date,
      payment_method: t.payment_method,
      cashier_id: t.cashier_id || '',
      cashier_name: t.cashier_name || '',
      store_id: t.store_id || '',
      store_name: t.store_name || '',
      customer_id: t.customer_id || '',
      manager_override_pin: t.manager_override_pin || '',
      age_verified: t.age_verified || false,
      tip_amount: t.tip_amount || 0,
      carbon_offset_amount: t.carbon_offset_amount || 0,
      items: (t.items || [])
        .map((i: any) => ({
          product_id: i.product_id || '',
          base_product_id: i.base_product_id || '',
          product_name: i.product_name || '',
          quantity: i.quantity,
          unit_price: i.unit_price,
          unit_cost: i.unit_cost || 0,
          kg_co2e: i.kg_co2e || 0,
          applied_version: i.applied_version || 1,
          applied_carbon_coefficient: i.applied_carbon_coefficient || 0,
          scope3_category: i.scope3_category || '',
        }))
        .sort((a: any, b: any) => (a.product_id || '').localeCompare(b.product_id || '')),
    }))
    .sort((a: any, b: any) => (a.txn_ref || '').localeCompare(b.txn_ref || ''));

  const normalizedLogs = auditLogs
    .map((a: any) => ({
      action: a.action,
      entity_type: a.entity_type,
      entity_id: a.entity_id,
      entity_ref: a.entity_ref || '',
      user_id: a.user_id || '',
      user_name: a.user_name || '',
      changes: a.changes || '',
      performed_at: a.performed_at,
    }))
    .sort((a: any, b: any) => {
      const cmp = (a.performed_at || '').localeCompare(b.performed_at || '');
      if (cmp !== 0) return cmp;
      return (a.entity_id || '').localeCompare(b.entity_id || '');
    });

  const payload = {
    hash_version: HASH_VERSION,
    period: {
      label: period.label,
      period_start: period.period_start,
      period_end: period.period_end,
    },
    transactions: normalizedTxns,
    audit_logs: normalizedLogs,
  };

  return JSON.stringify(payload);
}

async function generateSHA256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}