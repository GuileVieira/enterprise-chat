import { AuthContextProvider } from '~/hooks/AuthContext';
import ShareView from '~/components/Share/ShareView';

export default function ShareRoute({ isTenantShare = false }: { isTenantShare?: boolean }) {
  return (
    <AuthContextProvider authConfig={{ loginRedirect: '/login', optional: true }}>
      <ShareView isTenantShare={isTenantShare} />
    </AuthContextProvider>
  );
}
