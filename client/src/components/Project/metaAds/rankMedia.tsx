import type { Localize, MetaAdsBiRankItem } from './types';

function getThumbnailRotation(index: number) {
  if (index === 0) {
    return '-rotate-3 group-hover:-rotate-6 group-hover:-translate-x-1';
  }

  if (index === 1) {
    return 'rotate-1 group-hover:translate-y-0.5';
  }

  return 'rotate-3 group-hover:rotate-6 group-hover:translate-x-1';
}

export function MetaAdsRankMedia({
  item,
  localize,
  size = 'sm',
}: {
  item: MetaAdsBiRankItem;
  localize: Localize;
  size?: 'sm' | 'lg';
}) {
  const thumbnails = item.thumbnailUrls?.slice(0, 3) ?? [];
  const isLarge = size === 'lg';
  const frameClass = isLarge ? 'h-28 w-40' : 'h-12 w-16';
  const emptyClass = isLarge ? 'text-xs' : 'text-[9px]';

  if (thumbnails.length === 0) {
    return (
      <div
        data-testid="meta-ads-rank-media"
        className={`${frameClass} flex shrink-0 items-center justify-center border border-white/10 bg-[#1a1712] px-2 text-center ${emptyClass} text-[#81796b]`}
      >
        {localize('com_ui_project_meta_ads_no_creative_media')}
      </div>
    );
  }

  if (thumbnails.length === 1) {
    return (
      <div
        data-testid="meta-ads-rank-media"
        className={`${frameClass} shrink-0 overflow-hidden border border-white/10 bg-[#1a1712]`}
      >
        <img
          src={thumbnails[0]}
          alt=""
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
    );
  }

  return (
    <div data-testid="meta-ads-rank-media" className={`${frameClass} relative shrink-0`}>
      {thumbnails.map((thumbnailUrl, index) => {
        const offset = isLarge ? index * 12 : index * 6;
        const rotation = getThumbnailRotation(index);
        return (
          <div
            key={thumbnailUrl}
            className={`absolute inset-y-0 overflow-hidden border border-white/10 bg-[#1a1712] shadow-[0_18px_30px_-24px_rgba(0,0,0,0.85)] transition duration-300 ease-out group-hover:border-white/20 group-hover:shadow-[0_22px_34px_-22px_rgba(0,0,0,0.95)] ${rotation}`}
            style={{ left: offset, right: Math.max(0, (thumbnails.length - 1 - index) * offset) }}
          >
            <img
              src={thumbnailUrl}
              alt=""
              className="h-full w-full object-cover transition duration-300 ease-out group-hover:scale-105"
            />
          </div>
        );
      })}
    </div>
  );
}
