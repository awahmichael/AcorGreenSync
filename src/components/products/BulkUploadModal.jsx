/**
 * BulkUploadModal — Multi-step bulk catalog upload interface.
 *
 * Flow:
 *   1. Upload: Select CSV/Excel file + enter store identifier
 *   2. Processing: Background chunked ingestion with live progress
 *   3. Review: Summary stats (UPC count, pseudo-UPC count, CO2e mapped)
 *   4. Syncing: Cloud sync with progress
 *   5. Complete: Success confirmation
 */

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCatalogIngestion } from '@/hooks/useCatalogIngestion';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle,
  Cloud, Package, Barcode, Leaf, ArrowRight,
} from 'lucide-react';

const STEPS = {
  UPLOAD: 'upload',
  EXTRACTING: 'extracting',
  PROCESSING: 'processing',
  REVIEW: 'review',
  SYNCING: 'syncing',
  COMPLETE: 'complete',
};

export default function BulkUploadModal({ onClose, onSynced }) {
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [file, setFile] = useState(null);
  const [storePrefix, setStorePrefix] = useState('store01');
  const [extractMsg, setExtractMsg] = useState('');
  const { processing, syncing, progress, results, error, processCatalog, syncToCloud, reset } = useCatalogIngestion();
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  };

  const handleUploadAndProcess = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }
    if (!storePrefix.trim()) {
      toast.error('Store identifier is required for pseudo-UPC generation');
      return;
    }

    setStep(STEPS.EXTRACTING);
    setExtractMsg('Uploading file...');

    try {
      // Step 1: Upload file to Base44 storage
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      setExtractMsg('Extracting product data...');

      // Step 2: Extract structured data from CSV/Excel
      const extraction = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'object',
          properties: {
            upc: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' },
            category: { type: 'string' },
            sku: { type: 'string' },
            unit: { type: 'string' },
            stock: { type: 'number' },
          },
          required: ['name', 'price'],
        },
      });

      if (extraction.status !== 'success' || !extraction.output) {
        throw new Error(extraction.details || 'Failed to extract data from file');
      }

      const rawItems = Array.isArray(extraction.output) ? extraction.output : [extraction.output];

      if (rawItems.length === 0) {
        throw new Error('No items found in the uploaded file');
      }

      // Step 3: Process through ingestion pipeline (web worker)
      setStep(STEPS.PROCESSING);
      await processCatalog(rawItems, storePrefix.trim());
      setStep(STEPS.REVIEW);
    } catch (err) {
      toast.error(`Upload failed: ${err.message}`);
      setStep(STEPS.UPLOAD);
    }
  };

  const handleSyncToCloud = async () => {
    if (!results?.skus) return;
    setStep(STEPS.SYNCING);
    try {
      const synced = await syncToCloud(results.skus);
      setStep(STEPS.COMPLETE);
      toast.success(`${synced} products synced to cloud`);
    } catch (err) {
      toast.error(`Sync failed: ${err.message}`);
      setStep(STEPS.REVIEW);
    }
  };

  const handleClose = () => {
    if (processing || syncing) return; // Don't allow closing during operations
    if (step === STEPS.COMPLETE && onSynced) onSynced();
    reset();
    onClose();
  };

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const syncPct = results?.skus ? Math.round((progress.synced / results.skus.length) * 100) : 0;

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Bulk Catalog Upload
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === STEPS.UPLOAD && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Store Identifier</Label>
              <Input
                value={storePrefix}
                onChange={e => setStorePrefix(e.target.value)}
                placeholder="e.g. store01"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Used to generate pseudo-UPCs for items without barcodes (e.g. <code className="font-mono">{storePrefix}_local_sourdough_loaf_pseudo</code>)
              </p>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-green-50/50 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <div className="text-sm font-medium text-foreground">Drop CSV or Excel file here</div>
                  <div className="text-xs text-muted-foreground">or click to browse</div>
                </div>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground mb-1">Expected columns:</div>
              <div><code className="font-mono">upc</code> (optional), <code className="font-mono">name</code> *, <code className="font-mono">price</code> *</div>
              <div><code className="font-mono">category</code>, <code className="font-mono">sku</code>, <code className="font-mono">unit</code>, <code className="font-mono">stock</code></div>
              <div className="text-muted-foreground/70 mt-1">Supports 10,000+ items. Processing runs in background to keep POS responsive.</div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
              <Button onClick={handleUploadAndProcess} disabled={!file || !storePrefix.trim()} className="flex-1 bg-primary hover:bg-primary/90">
                Upload & Process
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Extracting */}
        {step === STEPS.EXTRACTING && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <div className="text-sm font-medium text-foreground">{extractMsg}</div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === STEPS.PROCESSING && (
          <div className="py-6 space-y-4">
            <div className="text-center space-y-1">
              <div className="text-sm font-medium text-foreground">Processing catalog in background...</div>
              <div className="text-xs text-muted-foreground">Chunked via web worker — POS remains fully responsive</div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress.current.toLocaleString()} / {progress.total.toLocaleString()} items</span>
                <span>{pct}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
                <Barcode className="w-4 h-4 mx-auto text-green-600 mb-1" />
                <div className="text-lg font-bold text-green-700">{progress.pseudoCount}</div>
                <div className="text-xs text-green-600">Pseudo-UPC</div>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
                <Leaf className="w-4 h-4 mx-auto text-green-600 mb-1" />
                <div className="text-lg font-bold text-green-700">{progress.mappedCount}</div>
                <div className="text-xs text-green-600">CO₂e Mapped</div>
              </div>
              <div className="bg-muted border border-border rounded-lg p-3 text-center">
                <Package className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                <div className="text-lg font-bold text-foreground">{progress.current - progress.pseudoCount}</div>
                <div className="text-xs text-muted-foreground">With UPC</div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === STEPS.REVIEW && results && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
              <CheckCircle2 className="w-4 h-4" />
              Processing complete — review the summary below
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{results.total.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Total Items</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{(results.total - results.pseudoCount).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-0.5">With UPC Barcode</div>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-amber-700">{results.pseudoCount}</div>
                <div className="text-xs text-amber-600 mt-0.5">Pseudo-UPC Generated</div>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-700">{results.mappedCount}</div>
                <div className="text-xs text-green-600 mt-0.5">CO₂e Mapped</div>
              </div>
            </div>

            {results.unmappedCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {results.unmappedCount} item(s) could not be category-mapped and received a conservative fallback baseline (1.0 kg CO₂e). These are flagged for review.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => { reset(); setStep(STEPS.UPLOAD); }} className="flex-1">Start Over</Button>
              <Button onClick={handleSyncToCloud} className="flex-1 bg-primary hover:bg-primary/90">
                <Cloud className="w-4 h-4 mr-2" />
                Sync to Cloud
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Syncing */}
        {step === STEPS.SYNCING && (
          <div className="py-6 space-y-4">
            <div className="text-center space-y-1">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
              <div className="text-sm font-medium text-foreground">Syncing to cloud...</div>
              <div className="text-xs text-muted-foreground">{progress.synced.toLocaleString()} / {results?.skus.length.toLocaleString()} products</div>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${syncPct}%` }} />
            </div>
          </div>
        )}

        {/* Step 6: Complete */}
        {step === STEPS.COMPLETE && (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">Catalog Onboarded Successfully</div>
              <div className="text-sm text-muted-foreground mt-1">
                {results?.total.toLocaleString()} products synced to cloud with CO₂e coefficients
              </div>
            </div>
            <Button onClick={handleClose} className="bg-primary hover:bg-primary/90 px-8">
              Done
            </Button>
          </div>
        )}

        {error && step !== STEPS.PROCESSING && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}