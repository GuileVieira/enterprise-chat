import { useEffect, useRef, useState } from 'react';

interface RecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export default function useDictation(
  scope: string,
  enabled: boolean,
  append: (id: string, text: string) => void,
) {
  const SpeechRecognition =
    (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
  const recognitionRef = useRef<Recognition | null>(null);
  const appendRef = useRef(append);
  appendRef.current = append;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<
    'com_ui_microphone_unavailable' | 'com_ui_project_meta_ads_diary_dictation_error' | null
  >(null);

  useEffect(() => {
    setActiveId(null);
    setError(null);
    return () => {
      const recognition = recognitionRef.current;
      if (!recognition) {
        return;
      }
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [scope, enabled]);

  const toggle = (id: string) => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    if (!enabled || !SpeechRecognition) {
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal && result[0].transcript.trim()) {
          appendRef.current(id, result[0].transcript.trim());
        }
      }
    };
    recognition.onerror = ({ error: code }) => {
      if (code === 'aborted') {
        return;
      }
      setError(
        ['not-allowed', 'service-not-allowed', 'audio-capture'].includes(code)
          ? 'com_ui_microphone_unavailable'
          : 'com_ui_project_meta_ads_diary_dictation_error',
      );
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setActiveId(null);
    };
    setError(null);
    setActiveId(id);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setActiveId(null);
      setError('com_ui_project_meta_ads_diary_dictation_error');
    }
  };

  return { activeId, error, supported: Boolean(SpeechRecognition), toggle };
}
