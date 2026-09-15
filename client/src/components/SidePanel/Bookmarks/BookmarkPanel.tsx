import { Permissions, PermissionTypes } from 'librechat-data-provider';
import { BookmarkContext } from '~/Providers/BookmarkContext';
import { useConversationTagsQuery } from '~/data-provider';
import BookmarkTable from './BookmarkTable';
import { useHasAccess } from '~/hooks';

const BookmarkPanel = () => {
  const canUseBookmarks = useHasAccess({
    permissionType: PermissionTypes.BOOKMARKS,
    permission: Permissions.USE,
  });
  const { data, isLoading } = useConversationTagsQuery({ enabled: canUseBookmarks });

  return (
    <div className="flex h-full w-full flex-col overflow-hidden pt-2">
      <BookmarkContext.Provider value={{ bookmarks: data || [] }}>
        <BookmarkTable isLoading={isLoading} />
      </BookmarkContext.Provider>
    </div>
  );
};
export default BookmarkPanel;
