/**
 * ACORCLOUD GREEN-SYNC: RML — BULK CATALOG INGESTION PIPELINE
 *
 * Handles onboarding of retailers with large product catalogs (10,000+ items).
 * Processes items in chunks, handles UPC variations (pseudo-UPC generation),
 * and maps CO2e coefficients through a tiered lookup process:
 *   1. Direct UPC/SKU match in existing inventory
 *   2. Algorithmic Category Mapping (DEFRA category baseline)
 *   3. Conservative fallback baseline (1.0 kg CO2e)
 *
 * Ported from the Rust/WASM CatalogIngestionPipeline struct.
 */

import { createInventorySku } from './structures';

// ── Conservative Fallback Baseline ──────────────────────────────────
// Ensures every item has a valid, auditable emission factor from day one.
const FALLBACK_BASELINE_KG_CO2E = 1.0;

// ── Default Category Baseline Coefficients ──────────────────────────
// Conservative estimates aligned with DEFRA 2024 frameworks.
// Overridden at runtime by EmissionFactor entity records where available.
const DEFAULT_CATEGORY_BASELINES = Object.freeze({
  'Food & Beverages': 0.85,
  'Clothing & Textiles': 5.20,
  'Electronics': 12.50,
  'Furniture': 8.30,
  'Household Goods': 2.10,
  'Health & Beauty': 3.40,
  'Sports & Leisure': 6.70,
  'Books & Stationery': 1.80,
  'Automotive': 15.00,
  'Other': FALLBACK_BASELINE_KG_CO2E,
});

/**
 * Generates a deterministic pseudo-UPC for items without a barcode.
 * Combines the retailer's store code with a slugified product name.
 *
 * @example generatePseudoUpc('store77', 'Local Sourdough Loaf')
 *          → "store77_local_sourdough_loaf_pseudo"
 */
export function generatePseudoUpc(storePrefix, productName) {
  const cleanName = (productName || 'unnamed')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${storePrefix}_${cleanName}_pseudo`;
}

/**
 * Builds a category carbon registry from DEFRA EmissionFactor records.
 * Maps each category string to its baseline kg CO2e per unit.
 *
 * @param {Array} emissionFactors - EmissionFactor entity records
 * @returns {Object} — { [category]: kg_co2e_per_unit }
 */
export function buildCategoryCarbonRegistry(emissionFactors = []) {
  const registry = { ...DEFAULT_CATEGORY_BASELINES };

  for (const factor of emissionFactors) {
    if (factor.is_active === false) continue;
    if (!factor.category || !factor.kg_co2e_per_unit) continue;
    // Use the most recent factor per category
    const existing = registry[`${factor.category}__year`];
    if (existing === undefined || (factor.year || 0) >= existing) {
      registry[factor.category] = factor.kg_co2e_per_unit;
      registry[`${factor.category}__year`] = factor.year || 0;
    }
  }

  return registry;
}

/**
 * CatalogIngestionPipeline
 *
 * Processes bulk catalog uploads at the edge node. Converts raw spreadsheet
 * entries into formatted, compliance-ready database models with:
 *   - Dynamic identifier evaluation (UPC or pseudo-UPC)
 *   - Tiered environmental coefficient mapping
 *   - Atomic storage assembly with SCD Type 2 versioning
 */
export class CatalogIngestionPipeline {
  constructor(storePrefix = 'store', categoryRegistry = null) {
    this.retailerStorePrefix = storePrefix;
    this.categoryCarbonRegistry = categoryRegistry || { ...DEFAULT_CATEGORY_BASELINES };
    this.localDatabaseTable = [];
  }

  /**
   * Processes a batch of raw product records.
   *
   * @param {Array<RawUploadedItem>} batch - Raw items from the retailer's spreadsheet
   * @param {Array} existingSkus - Cached SKUs for direct UPC/SKU match (tier 1)
   * @returns {{ processed: number, skus: Array, pseudoCount: number, mappedCount: number }}
   */
  processBulkUploadBatch(batch, existingSkus = []) {
    const skus = [];
    let pseudoCount = 0;
    let mappedCount = 0;

    // Build a quick lookup map for tier 1 (direct match)
    const existingByUpc = new Map();
    const existingBySku = new Map();
    for (const s of existingSkus) {
      if (s.upc) existingByUpc.set(s.upc, s);
      if (s.sku) existingBySku.set(s.sku, s);
    }

    for (const rawItem of batch) {
      // ── 1. DYNAMIC IDENTIFIER EVALUATION ──────────────────────
      let finalLookupCode;
      let isPseudo;

      if (rawItem.upc && String(rawItem.upc).trim().length > 0) {
        finalLookupCode = String(rawItem.upc).trim();
        isPseudo = false;
      } else {
        // No UPC — apply internal relational partitioning strategy
        finalLookupCode = generatePseudoUpc(
          this.retailerStorePrefix,
          rawItem.name || 'unnamed'
        );
        isPseudo = true;
        pseudoCount++;
      }

      // ── 2. ENVIRONMENTAL COEFFICIENT MAPPING PIPELINE ────────
      let mappedCarbonCoefficient;
      let emissionSource;
      let mappingStatus;

      // Tier 1: Direct SKU/UPC association
      const directMatch = existingByUpc.get(finalLookupCode) ||
        existingBySku.get(rawItem.sku || '') ||
        null;

      if (directMatch && directMatch.carbon_coefficient) {
        mappedCarbonCoefficient = directMatch.carbon_coefficient;
        emissionSource = directMatch.emission_factor_source || 'DEFRA';
        mappingStatus = 'Mapped';
        mappedCount++;
      } else {
        // Tier 2: Algorithmic Category Mapping (baseline)
        const categoryKey = rawItem.category || rawItem.category_id || 'Other';
        const baselineFactor = this.categoryCarbonRegistry[categoryKey];

        if (baselineFactor !== undefined) {
          mappedCarbonCoefficient = baselineFactor;
          emissionSource = 'DEFRA';
          mappingStatus = 'Mapped';
          mappedCount++;
        } else {
          // Tier 3: Strict Fallback — safe standard baseline
          mappedCarbonCoefficient = FALLBACK_BASELINE_KG_CO2E;
          emissionSource = 'Manual';
          mappingStatus = 'Flagged';
        }
      }

      // ── 3. ATOMIC STORAGE ASSEMBLY ───────────────────────────
      const standardizedProduct = createInventorySku({
        name: rawItem.name || 'Unnamed Product',
        price: Number(rawItem.price) || 0,
        stock_quantity: Number(rawItem.stock || rawItem.stock_quantity) || 0,
        upc: finalLookupCode,
        sku: rawItem.sku || (isPseudo ? finalLookupCode : ''),
        unit: rawItem.unit || 'unit',
        category: rawItem.category || rawItem.category_id || 'Other',
        emission_factor_defra: mappedCarbonCoefficient,
        emission_factor_source: emissionSource,
        emission_mapping_status: mappingStatus,
        scope3_category: rawItem.scope3_category || 'Both',
      });

      // Flag pseudo-coded items for traceability
      standardizedProduct.is_pseudo_coded = isPseudo;

      skus.push(standardizedProduct);
    }

    this.localDatabaseTable.push(...skus);

    return {
      processed: skus.length,
      skus,
      pseudoCount,
      mappedCount,
    };
  }
}

// Convenience factory
export function createIngestionPipeline(storePrefix, categoryRegistry) {
  return new CatalogIngestionPipeline(storePrefix, categoryRegistry);
}