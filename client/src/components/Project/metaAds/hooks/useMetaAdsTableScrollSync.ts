import { useRef } from 'react';
import type { UIEvent } from 'react';

export function useMetaAdsTableScrollSync() {
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const stickyHorizontalScrollRef = useRef<HTMLDivElement | null>(null);
  const isSyncingHorizontalScrollRef = useRef(false);

  const releaseHorizontalScrollSync = () => {
    window.requestAnimationFrame(() => {
      isSyncingHorizontalScrollRef.current = false;
    });
  };

  const onTableScroll = (event: UIEvent<HTMLDivElement>) => {
    if (isSyncingHorizontalScrollRef.current) {
      return;
    }
    const stickyScroll = stickyHorizontalScrollRef.current;
    if (!stickyScroll || stickyScroll.scrollLeft === event.currentTarget.scrollLeft) {
      return;
    }
    isSyncingHorizontalScrollRef.current = true;
    stickyScroll.scrollLeft = event.currentTarget.scrollLeft;
    releaseHorizontalScrollSync();
  };

  const onStickyHorizontalScroll = (event: UIEvent<HTMLDivElement>) => {
    if (isSyncingHorizontalScrollRef.current) {
      return;
    }
    const tableScroll = tableScrollRef.current;
    if (!tableScroll || tableScroll.scrollLeft === event.currentTarget.scrollLeft) {
      return;
    }
    isSyncingHorizontalScrollRef.current = true;
    tableScroll.scrollLeft = event.currentTarget.scrollLeft;
    releaseHorizontalScrollSync();
  };

  return {
    tableScrollRef,
    stickyHorizontalScrollRef,
    onTableScroll,
    onStickyHorizontalScroll,
  };
}
