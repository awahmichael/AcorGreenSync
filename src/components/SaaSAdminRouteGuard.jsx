import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import SaaSAdmin from '@/pages/SaaSAdmin';

export default function SaaSAdminRouteGuard() {
  const { user } = useAuth();
  if (!user?.collaborator_role) {
    return <Navigate to="/" replace />;
  }
  return <SaaSAdmin />;
}