import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * ACORCLOUD GREEN-SYNC: RegTech Integrity Seal
 * 
 * Seals a ReportingPeriod by generating a SHA-256 hash over all
 * transactions, audit logs, and personnel metadata within the period.
 * 
 * The hash is deterministic: an auditor can re-run the same logic
 * at any future date and compare the result to the stored data_hash.
 * If they match, the data is mathematically proven unaltered.
 * 
 * Hash payload includes (per transaction):
 *   - transaction_ref, total_amount, total_kg_co2e, transaction_date
 *   - items (sorted by product_id, including quantity, unit_price, kg_co2e)
 *   - cashier_id, store_id, manager_override_pin, payment_method
 * 
 * Also includes all AuditLog entries for the period (sorted by performed_at).
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
    if (period.status === 'locked') {
      return Response.json({ error: 'Period is already locked', data_hash: period.data_hash }, { status: 409 });
    }

    // 2. Fetch all transactions within the period range
    //    Use service role to ensure we capture ALL records regardless of user scoping
    const startDate = period.period_start + 'T00:00:00.000Z';
    const endDate = period.period_end + 'T23:59:59.999Z';

    // Fetch transactions — we need to paginate if there are many
    let allTransactions: any[] = [];
    let offset = 0;
    const pageSize = 200;
    while (true) {
      const batch = await base44.asServiceRole.entities.Transaction.list('-transaction_date', pageSize, offset);
      // Filter by date range (SDK doesn't support $gte natively in filter, so we filter server-side)
      const filtered = (batch as any[]).filter((t: any) => {
        const td = t.transaction_date;
        if (!td) return false;
        return td >= startDate && td <= endDate;
      });
      allTransactions = allTransactions.concat(filtered);
      if ((batch as any[]).length < pageSize) break;
      offset += pageSize;
      // Safety cap
      if (offset > 10000) break;
    }

    // 3. Fetch all audit logs for the period range
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

    // 4. Build the deterministic hash payload
    const hashPayload = buildDeterministicPayload(period, allTransactions, allAuditLogs);

    // 5. Generate SHA-256 hash using SubtleCrypto
    const dataHash = await generateSHA256(hashPayload);

    // 6. Calculate period totals (snapshot at lock time)
    const totalKgCo2e = allTransactions.reduce((sum: number, t: any) => sum + (t.total_kg_co2e || 0), 0);
    const totalRevenue = allTransactions.reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0);

    // 7. Lock the period with the hash
    const updated = await base44.asServiceRole.entities.ReportingPeriod.update(period_id, {
      status: 'locked',
      locked_by: user.full_name || user.email || 'Unknown',
      locked_at: new Date().toISOString(),
      total_kg_co2e: totalKgCo2e,
      total_revenue: totalRevenue,
      total_transactions: allTransactions.length,
      data_hash: dataHash,
      hash_version: HASH_VERSION,
      sealed_audit_log_ids: allAuditLogs.map((a: any) => a.id),
    });

    // 8. Create an immutable audit log entry for the seal event itself
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'period_lock',
      entity_type: 'ReportingPeriod',
      entity_id: period_id,
      entity_ref: period.label,
      user_id: user.id,
      user_name: user.full_name || user.email || 'Unknown',
      changes: JSON.stringify({
        hash: dataHash,
        hash_version: HASH_VERSION,
        transaction_count: allTransactions.length,
        audit_log_count: allAuditLogs.length,
        total_kg_co2e: totalKgCo2e,
        total_revenue: totalRevenue,
      }),
      notes: `Period sealed with SHA-256 integrity hash. ${allTransactions.length} transactions, ${allAuditLogs.length} audit logs anchored.`,
      performed_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      period_id,
      label: period.label,
      data_hash: dataHash,
      hash_version: HASH_VERSION,
      transaction_count: allTransactions.length,
      audit_log_count: allAuditLogs.length,
      total_kg_co2e: totalKgCo2e,
      total_revenue: totalRevenue,
      locked_by: user.full_name || user.email,
      locked_at: updated.locked_at,
    });
  } catch (error) {
    console.error('[sealReportingPeriod] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Builds a deterministic JSON payload from period data.
 * 
 * Determinism rules:
 *   - Transactions sorted by transaction_ref (ascending)
 *   - Line items within each transaction sorted by product_id (ascending)
 *   - Audit logs sorted by performed_at (ascending), then by id (tiebreaker)
 *   - Only "anchored" fields are included — volatile fields like updated_date are excluded
 */
function buildDeterministicPayload(period: any, transactions: any[], auditLogs: any[]): string {
  // --- Normalize and sort transactions ---
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

  // --- Normalize and sort audit logs ---
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

  // --- Build the final payload ---
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

/**
 * Generates a SHA-256 hash using the Web Crypto API (SubtleCrypto).
 * Returns a hex string.
 */
async function generateSHA256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}