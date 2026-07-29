import React from 'react';
import { render, screen } from '@testing-library/react';
import ProgressText from '../Parts/OpenAIImageGen/ProgressText';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => {
    const translations: Record<string, string> = {
      com_ui_creating_premium_image: 'Rendering premium image with Nano Banana Pro',
      com_ui_premium_image_created: 'Premium image created',
      com_ui_premium_image_starting: 'Starting Nano Banana Pro',
    };
    return translations[key] || key;
  },
}));

jest.mock('~/utils', () => ({
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' '),
}));

describe('Premium image progress text', () => {
  it('uses Nano Banana Pro wording for OpenRouter Gemini image generation', () => {
    render(<ProgressText progress={0.3} toolName="openrouter_gemini_image_gen" />);

    expect(screen.getByText('Rendering premium image with Nano Banana Pro')).toBeInTheDocument();
  });
});
