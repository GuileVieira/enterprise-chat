import ToggleSwitch from '../../ToggleSwitch';
import store from '~/store';

export default function TextToSpeechSwitch({
  onCheckedChange,
  disabled = false,
}: {
  onCheckedChange?: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <ToggleSwitch
      stateAtom={store.textToSpeech}
      localizationKey={'com_nav_text_to_speech' as const}
      switchId="TextToSpeech"
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      strongLabel={true}
    />
  );
}
