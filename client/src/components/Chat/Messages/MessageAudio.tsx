import { memo } from 'react';
import { useRecoilValue } from 'recoil';
import { useGetCustomConfigSpeechQuery } from 'librechat-data-provider/react-query';
import type { TMessageAudio } from '~/common';
import { BrowserTTS, ExternalTTS } from '~/components/Audio/TTS';
import { TTSEndpoints } from '~/common';
import { isSpeechFeatureEnabled } from '~/utils';
import store from '~/store';

function MessageAudio(props: TMessageAudio) {
  const engineTTS = useRecoilValue<string>(store.engineTTS);
  const { data: speechConfig } = useGetCustomConfigSpeechQuery();

  if (!isSpeechFeatureEnabled(speechConfig, 'textToSpeech')) {
    return null;
  }

  const TTSComponents = {
    [TTSEndpoints.browser]: BrowserTTS,
    [TTSEndpoints.external]: ExternalTTS,
  };

  const SelectedTTS = TTSComponents[engineTTS];
  if (!SelectedTTS) {
    return null;
  }
  return <SelectedTTS {...props} />;
}

export default memo(MessageAudio);
