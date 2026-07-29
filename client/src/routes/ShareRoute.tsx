import ShareView from '~/components/Share/ShareView';

export default function ShareRoute({ isTenantShare = false }: { isTenantShare?: boolean }) {
  return <ShareView isTenantShare={isTenantShare} />;
}
