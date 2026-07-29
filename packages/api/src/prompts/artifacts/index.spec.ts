import { ArtifactModes, EModelEndpoint } from 'librechat-data-provider';
import { generateArtifactsPrompt } from './index';

describe('generateArtifactsPrompt', () => {
  it.each([EModelEndpoint.anthropic, EModelEndpoint.openAI])(
    'includes slide deck guidance for %s',
    (endpoint) => {
      const prompt = generateArtifactsPrompt({ endpoint, artifacts: ArtifactModes.DEFAULT });

      expect(prompt).toContain('application/vnd.react');
      expect(prompt).toContain('useEmblaCarousel` from `embla-carousel-react');
      expect(prompt).toContain('SlideDeck`');
      expect(prompt).toContain('shared artifact link');
    },
  );

  it('does not override custom artifact instructions', () => {
    expect(
      generateArtifactsPrompt({
        endpoint: EModelEndpoint.openAI,
        artifacts: ArtifactModes.CUSTOM,
      }),
    ).toBeNull();
  });
});
