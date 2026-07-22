import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CategoryAdminModal from '../CategoryAdminModal';

const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

jest.mock('~/data-provider', () => ({
  useGetCategories: () => ({
    data: [
      { id: 'cat-1', label: 'Briefing', value: 'briefing', icon: '📋', order: 0 },
      { id: 'cat-2', label: 'SEO', value: 'seo', icon: '🔍', order: 1 },
    ],
  }),
  useCreateCategoryMutation: () => ({
    mutate: (...args: unknown[]) => mockCreate(...args),
    isLoading: false,
  }),
  useUpdateCategoryMutation: () => ({
    mutate: (...args: unknown[]) => mockUpdate(...args),
    isLoading: false,
  }),
  useDeleteCategoryMutation: () => ({
    mutate: (...args: unknown[]) => mockDelete(...args),
    isLoading: false,
  }),
}));

const pickerLabel = 'Pick Emoji';

jest.mock('emoji-picker-react', () => ({
  __esModule: true,
  default: ({ onEmojiClick }: { onEmojiClick: (data: { emoji: string }) => void }) => (
    <button data-testid="emoji-picker" onClick={() => onEmojiClick({ emoji: '🎯' })}>
      {pickerLabel}
    </button>
  ),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
  useAuthContext: () => ({ user: { role: 'admin' } }),
}));

describe('CategoryAdminModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders existing categories', () => {
    render(<CategoryAdminModal open={true} onClose={jest.fn()} />);

    expect(screen.getByText('Briefing')).toBeInTheDocument();
    expect(screen.getByText('SEO')).toBeInTheDocument();
  });

  it('creates a new category', async () => {
    render(<CategoryAdminModal open={true} onClose={jest.fn()} />);

    const input = screen.getByPlaceholderText('com_ui_category_name');
    fireEvent.change(input, { target: { value: 'Nova Categoria' } });

    const createButton = screen.getByText('com_ui_create');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Nova Categoria',
          value: 'nova_categoria',
          order: 2,
        }),
        expect.any(Object),
      );
    });
  });

  it('opens emoji picker for new category', () => {
    render(<CategoryAdminModal open={true} onClose={jest.fn()} />);

    const emojiButton = screen.getAllByText('📋')[0];
    fireEvent.click(emojiButton);

    const picker = screen.getByTestId('emoji-picker');
    fireEvent.click(picker);

    expect(screen.getByText('🎯')).toBeInTheDocument();
  });

  it('calls onClose when dialog is open', () => {
    const onClose = jest.fn();
    render(<CategoryAdminModal open={true} onClose={onClose} />);

    expect(screen.getByText('com_ui_manage_categories')).toBeInTheDocument();
  });
});
