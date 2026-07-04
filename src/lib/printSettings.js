const STORAGE_KEY = 'acorcloud_print_settings';

export const DEFAULT_SETTINGS = {
  receipt_mode: 'digital_first',
  receipt_style: 'standard',
  business_name: '',
  vat_number: '',
  address_line: '',
  footer_message: 'Thank you for shopping with us',
  show_carbon: true,
};

export function getPrintSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function savePrintSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}