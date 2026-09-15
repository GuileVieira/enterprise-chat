import React from 'react';
import '@testing-library/jest-dom/extend-expect';
import { RecoilRoot } from 'recoil';
import { render, fireEvent } from 'test/layout-test-utils';
import TextToSpeechSwitch from '../TextToSpeechSwitch';

const mockSpeechConfig = jest.fn(() => ({}));
jest.mock('librechat-data-provider/react-query', () => ({
  useGetCustomConfigSpeechQuery: () => ({ data: mockSpeechConfig() }),
}));

describe('TextToSpeechSwitch', () => {
  /**
   * Mock function to set the text-to-speech state.
   */
  let mockSetTextToSpeech: jest.Mock<void, [boolean]> | ((value: boolean) => void) | undefined;

  beforeEach(() => {
    mockSetTextToSpeech = jest.fn();
    mockSpeechConfig.mockReturnValue({});
  });

  it('is disabled when the server disables text to speech', () => {
    mockSpeechConfig.mockReturnValue({ textToSpeech: false });
    const { getByTestId } = render(
      <RecoilRoot>
        <TextToSpeechSwitch />
      </RecoilRoot>,
    );

    expect(getByTestId('TextToSpeech')).toBeDisabled();
  });

  it('renders correctly', () => {
    const { getByTestId } = render(
      <RecoilRoot>
        <TextToSpeechSwitch />
      </RecoilRoot>,
    );

    expect(getByTestId('TextToSpeech')).toBeInTheDocument();
  });

  it('calls onCheckedChange when the switch is toggled', () => {
    const { getByTestId } = render(
      <RecoilRoot>
        <TextToSpeechSwitch onCheckedChange={mockSetTextToSpeech} />
      </RecoilRoot>,
    );
    const switchElement = getByTestId('TextToSpeech');
    fireEvent.click(switchElement);

    expect(mockSetTextToSpeech).toHaveBeenCalledWith(false);
  });

  it('can be disabled by admin config', () => {
    const { getByTestId } = render(
      <RecoilRoot>
        <TextToSpeechSwitch disabled />
      </RecoilRoot>,
    );

    expect(getByTestId('TextToSpeech')).toBeDisabled();
  });
});
