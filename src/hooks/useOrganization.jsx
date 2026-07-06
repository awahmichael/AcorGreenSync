import { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const STORAGE_KEY = 'acorcloud_current_org_id';
const OrgContext = createContext(null);

export const OrgProvider = ({ children }) => {
  const { user } = useAuth();
  const isSuperAdmin = !!user?.collaborator_role;
  const [organizations, setOrganizations] = useState([]);
  const [currentOrg, setCurrentOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const provisioningRef = useRef(false);

  const loadOrgs = useCallback(async () => {
    // Super admins manage tenants from the SaaS Admin panel — don't auto-select a tenant org
    if (isSuperAdmin) {
      setOrganizations([]);
      setCurrentOrg(null);
      setLoading(false);
      return;
    }
    try {
      const orgs = await base44.entities.Organization.list('-created_date', 500);

      // Auto-provision a default org if user has none
      if (orgs.length === 0 && !provisioningRef.current) {
        provisioningRef.current = true;
        try {
          const response = await base44.functions.invoke('autoProvisionOrganization', {});
          const provisionedOrg = response.data?.organization;
          if (provisionedOrg) {
            const refreshedOrgs = await base44.entities.Organization.list('-created_date', 500);
            setOrganizations(refreshedOrgs || []);
            setCurrentOrg(provisionedOrg);
            localStorage.setItem(STORAGE_KEY, provisionedOrg.id);
            return;
          }
        } catch (err) {
          console.error('Auto-provision failed', err);
        }
      }

      setOrganizations(orgs || []);
      const savedId = localStorage.getItem(STORAGE_KEY);
      const saved = savedId ? orgs.find(o => o.id === savedId) : null;
      if (saved) {
        setCurrentOrg(saved);
      } else if (orgs.length > 0) {
        setCurrentOrg(orgs[0]);
        localStorage.setItem(STORAGE_KEY, orgs[0].id);
      }
    } catch (err) {
      console.error('Failed to load organizations', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrgs(); }, [loadOrgs, isSuperAdmin]);

  const switchOrg = useCallback((orgId) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      localStorage.setItem(STORAGE_KEY, orgId);
    }
  }, [organizations]);

  const refreshCurrentOrg = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const updated = await base44.entities.Organization.get(currentOrg.id);
      setCurrentOrg(updated);
    } catch (err) {
      console.error('Failed to refresh org', err);
    }
  }, [currentOrg]);

  return (
    <OrgContext.Provider value={{
      organizations, currentOrg, switchOrg, loading,
      organizationId: currentOrg?.id || null,
      refreshCurrentOrg, reloadOrgs: loadOrgs
    }}>
      {children}
    </OrgContext.Provider>
  );
};

export const useOrganization = () => {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrganization must be used within OrgProvider');
  return ctx;
};