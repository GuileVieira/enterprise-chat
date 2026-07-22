import { Permissions, PermissionTypes } from 'librechat-data-provider';
import { useConversationTagsQuery } from '~/data-provider';
import { BookmarkContext } from '~/Providers/BookmarkContext';
import { useHasAccess } from '~/hooks';
import BookmarkTable from './BookmarkTable';

const BookmarkPanel = () => {
  const canUseBookmarks = useHasAccess({
    permissionType: PermissionTypes.BOOKMARKS,
    permission: Permissions.USE,
  });
  const { data } = useConversationTagsQuery({ enabled: canUseBookmarks });

  return (
    <div className="h-auto max-w-full overflow-x-visible pt-2">
      <BookmarkContext.Provider value={{ bookmarks: data || [] }}>
        <BookmarkTable />
      </BookmarkContext.Provider>
    </div>
  );
};
export default BookmarkPanel;
