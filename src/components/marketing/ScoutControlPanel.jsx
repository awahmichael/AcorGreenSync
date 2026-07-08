import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Radar, Play, Loader2, Plus, X, Building2, MapPin, TrendingUp, Target } from 'lucide-react';
import { toast } from 'sonner';

export default function ScoutControlPanel() {
  const [config, setConfig] = useState(null);
  const [leadCount, setLeadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);
  const [newCity, setNewCity] = useState('');

  const DEFAULT_SIC_CODES = ['47110','47190','47210','47220','47250','47260','47290','47710','47721','47722','47730','47740','47750','47760','47765','47770','47780','47791','47799'];

  const load = async () => {
    setLoading(true);
    try {
      const configs = await base44.entities.ScoutConfig.list('', 1);
      if (configs && configs.length > 0) {
        setConfig(configs[0]);
      } else {
        const newConfig = await base44.entities.ScoutConfig.create({
          is_enabled: false,
          target_cities: [],
          target_sic_codes: DEFAULT_SIC_CODES,
          daily_lead_limit: 20,
          leads_ingested_today: 0,
          last_ingested_date: new Date().toISOString().split('T')[0]
        });
        setConfig(newConfig);
      }
      try {
        const leads = await base44.entities.Lead_Scout.list('', 1);
        setLeadCount(leads.length);
      } catch { setLeadCount(0); }
    } catch {
      toast.error('Failed to load scout config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleEnabled = async () => {
    setToggling(true);
    try {
      const updated = await base44.entities.ScoutConfig.update(config.id, { is_enabled: !config.is_enabled });
      setConfig(updated);
      toast.success(updated.is_enabled ? 'Scout activated — leads will be ingested on next run.' : 'Scout paused — dormant until re-enabled.');
    } catch (e) { toast.error(e.message); }
    finally { setToggling(false); }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('ingestCompaniesHouseLeads', {});
      const data = res.data || res;
      if (data.ingested > 0) {
        toast.success(`Ingested ${data.ingested} new leads (${data.skipped_duplicates || 0} duplicates skipped)`);
      } else {
        toast.info(data.message || 'No new leads found');
      }
      load();
    } catch (e) { toast.error(e.message); }
    finally { setRunning(false); }
  };

  const addCity = async () => {
    if (!newCity.trim()) { toast.error('Enter a city name'); return; }
    try {
      const updated = [...(config.target_cities || []), newCity.trim()];
      const newConfig = await base44.entities.ScoutConfig.update(config.id, { target_cities: updated });
      setConfig(newConfig);
      setNewCity('');
      toast.success(`Added ${newCity.trim()}`);
    } catch (e) { toast.error(e.message); }
  };

  const removeCity = async (city) => {
    try {
      const updated = (config.target_cities || []).filter(c => c !== city);
      const newConfig = await base44.entities.ScoutConfig.update(config.id, { target_cities: updated });
      setConfig(newConfig);
    } catch (e) { toast.error(e.message); }
  };

  const updateLimit = async (val) => {
    const num = parseInt(val) || 0;
    try {
      const newConfig = await base44.entities.ScoutConfig.update(config.id, { daily_lead_limit: num });
      setConfig(newConfig);
    } catch (e) { toast.error(e.message); }
  };

  if (loading || !config) {
    return <div className="bg-white border border-border rounded-xl p-6 h-48 animate-pulse mb-6" />;
  }

  const isLive = config.is_enabled;

  return (
    <div className={`bg-white border rounded-xl p-6 mb-6 ${isLive ? 'border-green-300 shadow-sm' : 'border-border'}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isLive ? 'bg-green-100' : 'bg-muted'}`}>
            <Radar className={`w-5 h-5 ${isLive ? 'text-green-600' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Lead Scout</h2>
            <p className="text-xs text-muted-foreground">Automated Companies House lead discovery</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={isLive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-muted text-muted-foreground'}>
            {isLive ? 'ACTIVE' : 'DORMANT'}
          </Badge>
          <Switch checked={isLive} onCheckedChange={toggleEnabled} disabled={toggling} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <Building2 className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
          <div className="text-2xl font-bold text-foreground">{leadCount}</div>
          <div className="text-xs text-muted-foreground">Total Leads</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <TrendingUp className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
          <div className="text-2xl font-bold text-foreground">{config.leads_ingested_today || 0}</div>
          <div className="text-xs text-muted-foreground">Today</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <Target className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
          <div className="text-2xl font-bold text-foreground">{config.daily_lead_limit}</div>
          <div className="text-xs text-muted-foreground">Daily Limit</div>
        </div>
      </div>

      <div className="mb-4">
        <Label className="text-xs font-medium text-muted-foreground mb-2 block">Target Cities</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {(config.target_cities || []).map(city => (
            <span key={city} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-xs font-medium">
              <MapPin className="w-3 h-3" />
              {city}
              <button onClick={() => removeCity(city)} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
            </span>
          ))}
          {(config.target_cities || []).length === 0 && <span className="text-xs text-muted-foreground">No cities added yet</span>}
        </div>
        <div className="flex gap-2">
          <Input value={newCity} onChange={e => setNewCity(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCity(); }} placeholder="Add city (e.g. Manchester)" className="h-8 text-sm" />
          <Button size="sm" variant="outline" onClick={addCity} className="h-8"><Plus className="w-3 h-3 mr-1" />Add</Button>
        </div>
      </div>

      <div className="mb-4">
        <Label className="text-xs font-medium text-muted-foreground mb-2 block">Daily Lead Limit</Label>
        <Input type="number" min="1" max="500" defaultValue={config.daily_lead_limit} onBlur={e => updateLimit(e.target.value)} className="h-8 text-sm w-32" />
      </div>

      <div className="flex items-center gap-3 pt-3 border-t border-border">
        <Button variant="outline" size="sm" onClick={runNow} disabled={running || !isLive}>
          {running ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
          Run Now
        </Button>
        <p className="text-xs text-muted-foreground">
          {isLive
            ? 'Scout will run automatically on schedule and when triggered manually.'
            : 'Enable the switch above to activate. Scout stays dormant until you are ready to launch.'}
        </p>
      </div>
    </div>
  );
}