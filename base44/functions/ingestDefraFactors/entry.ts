/**
 * ACORCLOUD GREEN-SYNC: MASTER DEFRA INGESTION ENGINE
 *
 * Parses the full DEFRA GHG Conversion Factors Excel file (40 sheets) directly
 * using SheetJS, extracts emission factor rows from each data sheet, and
 * bulk-inserts them as EmissionFactor records.
 *
 * Key insight from DEFRA structure:
 * - Each sheet has ~20 rows of metadata/guidance before the actual header row
 * - Header row contains: "Activity" (category), [item name col], "Unit", "kg CO2e", [gas breakdowns...]
 * - The "Activity" column is actually the CATEGORY, not the item name
 * - The item name is in the column just before "Unit"
 * - Category cells are merged — need forward-fill for blank rows
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

const SKIP_SHEETS = [
  'Introduction',
  "What's new",
  'Index',
  'Conversions',
  'Fuel properties',
  'Haul definition',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_url, year, dataset_version } = body;

    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }



    const ingestionYear = year || 2025;
    const versionTag = dataset_version || `${ingestionYear}_v1`;
    const ingestionISO = new Date().toISOString();

    // 1. Fetch and parse the Excel file
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      return Response.json({ error: `Failed to fetch file: ${fileResponse.status}` }, { status: 502 });
    }
    const arrayBuffer = await fileResponse.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

    const allFactors = [];
    const sheetSummaries = [];

    // 2. Process each sheet
    for (const sheetName of workbook.SheetNames) {
      if (SKIP_SHEETS.includes(sheetName)) {
        sheetSummaries.push({ sheet: sheetName, status: 'skipped', rows: 0 });
        continue;
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

      if (rows.length === 0) {
        sheetSummaries.push({ sheet: sheetName, status: 'empty', rows: 0 });
        continue;
      }

      // 2a. Extract scope from metadata rows (row with "Scope:" label)
      let sheetScope = 'Scope 3';
      for (let i = 0; i < Math.min(8, rows.length); i++) {
        const row = rows[i];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          const cellVal = String(row[c] || '').toLowerCase().trim();
          if (cellVal === 'scope:' || cellVal === 'scope') {
            if (row[c + 1]) {
              const scopeRaw = String(row[c + 1]).toLowerCase().trim();
              if (scopeRaw.includes('scope 1') || scopeRaw === 'scope1') {
                sheetScope = 'Scope 1';
              } else if (scopeRaw.includes('scope 2') || scopeRaw === 'scope2') {
                sheetScope = 'Scope 2';
              } else if (scopeRaw.includes('scope 3') || scopeRaw === 'scope3') {
                sheetScope = 'Scope 3';
              } else if (scopeRaw.includes('outside')) {
                sheetScope = 'Outside of Scopes';
              }
              break;
            }
          }
        }
      }

      // 2b. Find the header row — look for "kg co2e" or "ghg conversion factor"
      // (NOT the title which says "ghg conversion factors for company reporting")
      let headerRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const found = row.some(cell => {
          const s = String(cell || '').toLowerCase().trim();
          if (s.includes('government') || s.includes('company reporting')) return false;
          return s === 'kg co2e' || s.startsWith('ghg conversion factor') || s === 'total kg co2e';
        });
        if (found) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        sheetSummaries.push({ sheet: sheetName, status: 'no_header_found', rows: 0 });
        continue;
      }

      const headers = rows[headerRowIndex].map(h =>
        h ? String(h).toLowerCase().trim() : ''
      );

      // 2c. Identify column indices
      const unitCol = headers.findIndex(h => h === 'unit' || h.includes('unit'));
      const factorCol = headers.findIndex(h =>
        h === 'kg co2e' || h.startsWith('ghg conversion factor') || h === 'total kg co2e'
      );

      if (factorCol === -1) {
        sheetSummaries.push({
          sheet: sheetName,
          status: 'no_factor_column',
          headers: headers.filter(h => h).slice(0, 12),
        });
        continue;
      }

      // Item name is the column just before unit (or just before factor if no unit)
      const itemNameCol = unitCol >= 0 ? unitCol - 1 : factorCol - 1;
      if (itemNameCol < 0) {
        sheetSummaries.push({ sheet: sheetName, status: 'no_item_column', rows: 0 });
        continue;
      }

      // Category is column 0 (forward-filled for merged cells)
      const categoryCol = 0;

      // Check for Level columns (some sheets use hierarchical categories)
      const level1Col = headers.findIndex(h => h.includes('level 1'));
      const level2Col = headers.findIndex(h => h.includes('level 2'));
      const level3Col = headers.findIndex(h => h.includes('level 3'));

      // 2d. Extract data rows with forward-fill for category
      let sheetRowCount = 0;
      let lastCategory = '';

      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        // Get item name
        const name = itemNameCol < row.length ? String(row[itemNameCol] || '').trim() : '';
        if (!name) continue;

        // Get factor value
        const factorRaw = factorCol < row.length ? row[factorCol] : null;
        const factorValue = typeof factorRaw === 'number' ? factorRaw : parseFloat(factorRaw);
        if (isNaN(factorValue)) continue;

        // Get unit
        const unit = (unitCol >= 0 && unitCol < row.length)
          ? String(row[unitCol] || '').trim()
          : 'kg';

        // Forward-fill category from column 0
        const categoryVal = (categoryCol < row.length)
          ? String(row[categoryCol] || '').trim()
          : '';
        if (categoryVal) lastCategory = categoryVal;

        // Build subcategory from Level columns if present
        let subcategory = null;
        const subParts = [];
        if (level2Col >= 0 && level2Col < row.length && row[level2Col]) {
          subParts.push(String(row[level2Col]).trim());
        }
        if (level3Col >= 0 && level3Col < row.length && row[level3Col]) {
          subParts.push(String(row[level3Col]).trim());
        }
        if (subParts.length > 0) subcategory = subParts.join(' > ');

        allFactors.push({
          name,
          source: 'DEFRA',
          category: lastCategory || sheetName,
          subcategory,
          commodity_code: null,
          kg_co2e_per_unit: factorValue,
          unit: unit || 'kg',
          scope: sheetScope,
          scope3_category: null,
          year: ingestionYear,
          dataset_version: versionTag,
          is_active: true,
        });
        sheetRowCount++;
      }

      sheetSummaries.push({ sheet: sheetName, status: 'processed', rows: sheetRowCount });
    }

    // 3. Deactivate any existing factors for this year+version
    await base44.asServiceRole.entities.EmissionFactor.updateMany(
      { year: ingestionYear, dataset_version: versionTag, source: 'DEFRA' },
      { $set: { is_active: false } }
    );

    // 4. Bulk insert in chunks of 500
    const CHUNK_SIZE = 500;
    let totalCreated = 0;
    for (let i = 0; i < allFactors.length; i += CHUNK_SIZE) {
      const chunk = allFactors.slice(i, i + CHUNK_SIZE);
      const created = await base44.asServiceRole.entities.EmissionFactor.bulkCreate(chunk);
      totalCreated += Array.isArray(created) ? created.length : 0;
    }

    // 5. Write SyncLog entry
    await base44.asServiceRole.entities.SyncLog.create({
      sync_type: 'emission_factor_refresh',
      status: 'success',
      records_synced: totalCreated,
      records_failed: 0,
      details: `DEFRA ingestion: ${totalCreated} factors from ${sheetSummaries.filter(s => s.status === 'processed').length} sheets (${versionTag})`,
      synced_at: ingestionISO,
    });

    return Response.json({
      status: 'success',
      year: ingestionYear,
      dataset_version: versionTag,
      total_factors: allFactors.length,
      ingested: totalCreated,
      sheets: sheetSummaries,
    });
  } catch (error) {
    console.error('ingestDefraFactors error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});