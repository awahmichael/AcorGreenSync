import { useState } from 'react';
import { Building2, ChevronDown, Check, Plus } from 'lucide-react';
import { useOrganization } from '@/hooks/useOrganization.jsx';
import { cn } from '@/lib/utils';
import OrganizationModal from '@/components/saasadmin/OrganizationModal';

export default function OrgSwitcher() {
  const { organizations, currentOrg, switchOrg, loading, reloadOrgs } = useOrganization();
  const [open, setOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (loading) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-muted/50 text-sm transition-colors"
      >
        <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="font-medium max-w-[100px] truncate hidden sm:inline">{currentOrg?.name || 'Select Org'}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-border rounded-lg shadow-lg z-20 max-h-72 overflow-y-auto">
            {organizations.map(org => (
              <button
                key={org.id}
                onClick={() => { switchOrg(org.id); setOpen(false); }}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 flex items-center justify-between text-sm border-b border-border last:border-0 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{org.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{org.plan_type} · {org.subscription_status}</div>
                </div>
                {currentOrg?.id === org.id && <Check className="w-4 h-4 text-primary flex-shrink-0 ml-2" />}
              </button>
            ))}
            <button
              onClick={() => { setOpen(false); setShowCreateModal(true); }}
              className="w-full text-left px-3 py-2.5 hover:bg-muted/50 flex items-center gap-2 text-sm font-medium text-primary transition-colors"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              Create New Organization
            </button>
          </div>
        </>
      )}
      {showCreateModal && (
        <OrganizationModal
          onClose={() => setShowCreateModal(false)}
          onSaved={async () => { await reloadOrgs(); }}
        />
      )}
    </div>
  );
}