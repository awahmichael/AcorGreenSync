/**
 * ACORCLOUD GREEN-SYNC: MASTER DEFRA INGESTION ENGINE
 *
 * Accepts an uploaded DEFRA Excel file (multi-sheet), extracts all rows,
 * normalizes them into EmissionFactor records with year/version tagging,
 * and bulk-inserts into the database.
 *
 * Flow:
 * 1. Receive file_url + year + dataset_version from admin
 * 2. Extract structured data via ExtractDataFromUploadedFile
 * 3. Deactivate any existing factors for this year/version (clean slate)
 * 4. Bulk create new EmissionFactor records
 * 5. Write SyncLog entry with summary
 *
 * This is the ONLY function that populates the EmissionFactor entity.
 * The existing syncDefraFactors function then propagates those factors
 * to tenant products via SCD Type 2 versioning.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json();
    const { file_url, year, dataset_version } = body;

    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    const ingestionYear = year || new Date().getFullYear();
    const versionTag = dataset_version || `${ingestionYear}_v1.0`;
    const ingestionISO = new Date().toISOString();

    // 1. Extract structured data from the uploaded Excel file
    const extraction = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: file_url,
      json_schema: {
        type: "object",
        properties: {
          factors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                category: { type: "string" },
                subcategory: { type: "string" },
                commodity_code: { type: "string" },
                kg_co2e_per_unit: { type: "number" },
                unit: { type: "string" },
                scope: { type: "string" },
                scope3_category: { type: "string" }
              }
            }
          }
        }
      }
    });

    if (extraction.status !== 'success' || !extraction.output) {
      return Response.json({
        error: 'Extraction failed',
        details: extraction.details || 'No output returned'
      }, { status: 422 });
    }

    // Normalize: handle both array and {factors: [...]} shapes
    let rawFactors = Array.isArray(extraction.output) ? extraction.output : (extraction.output.factors || []);

    if (rawFactors.length === 0) {
      return Response.json({
        status: 'success',
        message: 'No emission factor rows found in file.',
        ingested: 0
      });
    }

    // 2. Deactivate any existing factors for this year+version (clean slate for re-ingestion)
    await base44.asServiceRole.entities.EmissionFactor.updateMany(
      { year: ingestionYear, dataset_version: versionTag, source: 'DEFRA' },
      { $set: { is_active: false } }
    );

    // 3. Normalize and tag each row
    const validFactors = [];
    let skipped = 0;

    for (const row of rawFactors) {
      // Skip rows without a name or numeric factor value
      if (!row.name || typeof row.kg_co2e_per_unit !== 'number' || isNaN(row.kg_co2e_per_unit)) {
        skipped++;
        continue;
      }

      // Normalize scope value
      let scope = row.scope || 'Scope 3';
      const scopeLower = scope.toLowerCase().trim();
      if (scopeLower.includes('scope 1') || scopeLower.includes('scope1')) scope = 'Scope 1';
      else if (scopeLower.includes('scope 2') || scopeLower.includes('scope2')) scope = 'Scope 2';
      else if (scopeLower.includes('scope 3') || scopeLower.includes('scope3')) scope = 'Scope 3';
      else if (scopeLower.includes('outside')) scope = 'Outside of Scopes';

      validFactors.push({
        name: String(row.name).trim(),
        source: 'DEFRA',
        category: row.category ? String(row.category).trim() : 'Uncategorized',
        subcategory: row.subcategory ? String(row.subcategory).trim() : null,
        commodity_code: row.commodity_code ? String(row.commodity_code).trim() : null,
        kg_co2e_per_unit: row.kg_co2e_per_unit,
        unit: row.unit ? String(row.unit).trim() : 'kg',
        scope: scope,
        scope3_category: row.scope3_category ? String(row.scope3_category).trim() : null,
        year: ingestionYear,
        dataset_version: versionTag,
        is_active: true,
      });
    }

    // 4. Bulk insert (chunks of 500)
    const CHUNK_SIZE = 500;
    let totalCreated = 0;

    for (let i = 0; i < validFactors.length; i += CHUNK_SIZE) {
      const chunk = validFactors.slice(i, i + CHUNK_SIZE);
      const created = await base44.asServiceRole.entities.EmissionFactor.bulkCreate(chunk);
      totalCreated += Array.isArray(created) ? created.length : 0;
    }

    // 5. Write SyncLog entry
    await base44.asServiceRole.entities.SyncLog.create({
      sync_type: 'emission_factor_refresh',
      status: 'success',
      records_synced: totalCreated,
      records_failed: skipped,
      details: `DEFRA ingestion: ${totalCreated} factors ingested (${versionTag}), ${skipped} rows skipped (invalid/empty)`,
      synced_at: ingestionISO,
    });

    return Response.json({
      status: 'success',
      year: ingestionYear,
      dataset_version: versionTag,
      extracted_rows: rawFactors.length,
      ingested: totalCreated,
      skipped_invalid: skipped,
    });
  } catch (error) {
    console.error('ingestDefraFactors error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});