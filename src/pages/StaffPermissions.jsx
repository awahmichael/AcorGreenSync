import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Shield, Plus, KeyRound, Users, Lock } from 'lucide-react';
import { toast } from 'sonner';

const rolePermissions = {
  admin: { pos: true, products: true, inventory: true, reports: true, compliance: true, settings: true, staff: true, finance: true, label: 'Full Access', color: 'bg-purple-100 text-purple-700' },
  manager: { pos: true, products: true, inventory: true, reports: true, compliance: true, settings: false, staff: false, finance: true, label: 'Store Management', color: 'bg-blue-100 text-blue-700' },
  user: { pos: true, products: false, inventory: false, reports: false, compliance: false, settings: false, staff: false, finance: false, label: 'Cashier / POS Only', color: 'bg-gray-100 text-gray-700' },
};

const permissionLabels = { pos: 'POS Terminal', products: 'Product Management', inventory: 'Inventory', reports: 'Reports & Analytics', compliance: 'Carbon Compliance', settings: 'System Settings', staff: 'Staff Management', finance: 'Finance & Invoicing' };

export default function StaffPermissions() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  const load = async () => { setLoading(true); try { setUsers(await base44.entities.User.list()); } catch { toast.error('Failed to load staff'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const changeRole = async (user, newRole) => { try { await base44.entities.User.update(user.id, { role: newRole }); toast.success(`${user.full_name || user.email} → ${newRole}`); load(); } catch (e) { toast.error(e.message); } };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">Staff Permissions</h1><p className="text-sm text-muted-foreground mt-0.5">Role-based access control — PIN-based logins and permission matrix</p></div>
        <Button onClick={() => setShowInvite(true)} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />Invite Staff</Button>
      </div>

      {/* Role overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Object.entries(rolePermissions).map(([role, perms]) => (
          <div key={role} className="bg-white border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${perms.color}`}><Shield className="w-4 h-4" /></div>
              <div><div className="font-semibold text-foreground capitalize">{role}</div><div className="text-xs text-muted-foreground">{perms.label}</div></div>
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(perms).filter(([k]) => k !== 'label' && k !== 'color').map(([perm, enabled]) => enabled && <span key={perm} className="text-xs bg-muted/50 px-2 py-0.5 rounded-full text-muted-foreground">{permissionLabels[perm]}</span>)}
            </div>
          </div>
        ))}
      </div>

      {/* Permission matrix */}
      <div className="bg-white border border-border rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">Permission Matrix</span></div>
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Permission</th><th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Admin</th><th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Manager</th><th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Cashier</th></tr></thead>
          <tbody className="divide-y divide-border">
            {Object.entries(permissionLabels).map(([perm, label]) => (
              <tr key={perm} className="hover:bg-muted/30"><td className="px-4 py-2.5 text-sm font-medium">{label}</td><td className="px-4 py-2.5 text-center">{rolePermissions.admin[perm] ? '✓' : '—'}</td><td className="px-4 py-2.5 text-center">{rolePermissions.manager[perm] ? '✓' : '—'}</td><td className="px-4 py-2.5 text-center">{rolePermissions.user[perm] ? '✓' : '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Staff list */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2"><Users className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">Staff Members ({users.length})</span></div>
        {loading ? <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div> : (
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Name</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Email</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Current Role</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Change Role</th></tr></thead>
            <tbody className="divide-y divide-border">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-muted/30"><td className="px-4 py-3 text-sm font-medium">{u.full_name || '—'}</td><td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td><td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${rolePermissions[u.role]?.color || 'bg-gray-100'}`}>{u.role}</span></td><td className="px-4 py-3 text-right"><Select value={u.role} onValueChange={v => changeRole(u, v)}><SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="user">Cashier</SelectItem></SelectContent></Select></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onSaved={() => { setShowInvite(false); load(); }} />}
    </div>
  );
}

function InviteModal({ onClose, onSaved }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [saving, setSaving] = useState(false);
  const handleInvite = async () => {
    if (!email) { toast.error('Enter email'); return; }
    setSaving(true);
    try { await base44.users.inviteUser(email, role); toast.success(`Invitation sent to ${email}`); onSaved(); }
    catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Invite Staff Member</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Email Address *</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@store.com" /></div>
        <div className="space-y-1.5"><Label>Role</Label><Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Admin — Full Access</SelectItem><SelectItem value="manager">Manager — Store Management</SelectItem><SelectItem value="user">Cashier — POS Only</SelectItem></SelectContent></Select></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleInvite} disabled={saving}><Lock className="w-3.5 h-3.5 mr-1.5" />{saving ? 'Sending...' : 'Send Invite'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}