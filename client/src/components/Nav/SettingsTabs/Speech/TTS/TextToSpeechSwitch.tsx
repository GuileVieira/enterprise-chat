import { useGetCustomConfigSpeechQuery } from 'librechat-data-provider/react-query';
import { isSpeechFeatureDisabled } from '~/utils/speech';
import ToggleSwitch from '../../ToggleSwitch';
import store from '~/store';

export default function TextToSpeechSwitch({
  onCheckedChange,
  disabled = false,
}: {
  onCheckedChange?: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { data: speechConfig } = useGetCustomConfigSpeechQuery();
  const isDisabled = disabled || isSpeechFeatureDisabled(speechConfig, 'textToSpeech');

  return (
    <ToggleSwitch
      stateAtom={store.textToSpeech}
      localizationKey={'com_nav_text_to_speech' as const}
      switchId="TextToSpeech"
      onCheckedChange={onCheckedChange}
      disabled={isDisabled}
      strongLabel={true}
    />
  );
}
