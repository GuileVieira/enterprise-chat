import React from 'react';
import '@testing-library/jest-dom/extend-expect';
import { RecoilRoot } from 'recoil';
import { render, fireEvent } from 'test/layout-test-utils';
import SpeechToTextSwitch from '../SpeechToTextSwitch';

const mockSpeechConfig = jest.fn(() => ({}));
jest.mock('librechat-data-provider/react-query', () => ({
  useGetCustomConfigSpeechQuery: () => ({ data: mockSpeechConfig() }),
}));

describe('SpeechToTextSwitch', () => {
  /**
   * Mock function to set the speech-to-text state.
   */
  let mockSetSpeechToText: jest.Mock<void, [boolean]> | ((value: boolean) => void) | undefined;

  beforeEach(() => {
    mockSetSpeechToText = jest.fn();
    mockSpeechConfig.mockReturnValue({});
  });

  it('is disabled when the server disables speech to text', () => {
    mockSpeechConfig.mockReturnValue({ speechToText: false });
    const { getByTestId } = render(
      <RecoilRoot>
        <SpeechToTextSwitch />
      </RecoilRoot>,
    );

    expect(getByTestId('SpeechToText')).toBeDisabled();
  });

  it('renders correctly', () => {
    const { getByTestId } = render(
      <RecoilRoot>
        <SpeechToTextSwitch />
      </RecoilRoot>,
    );

    expect(getByTestId('SpeechToText')).toBeInTheDocument();
  });

  it('calls onCheckedChange when the switch is toggled', () => {
    const { getByTestId } = render(
      <RecoilRoot>
        <SpeechToTextSwitch onCheckedChange={mockSetSpeechToText} />
      </RecoilRoot>,
    );
    const switchElement = getByTestId('SpeechToText');
    fireEvent.click(switchElement);

    expect(mockSetSpeechToText).toHaveBeenCalledWith(false);
  });
});
