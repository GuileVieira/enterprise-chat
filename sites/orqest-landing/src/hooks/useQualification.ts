import { useState, useCallback } from 'react';

export interface QuizAnswer {
  question: string;
  answer: string;
}

export interface QuizState {
  step: number;
  answers: QuizAnswer[];
  score: number;
  isQualified: boolean | null;
  isComplete: boolean;
}

const QUESTIONS = [
  {
    id: 'team-size',
    question: 'Quantas pessoas tem sua equipe?',
    options: ['1-5', '6-15', '16-50', '50+'],
    scores: { '1-5': 0, '6-15': 1, '16-50': 2, '50+': 2 },
  },
  {
    id: 'uses-ai',
    question: 'Você já usa alguma ferramenta de IA hoje?',
    options: ['Sim', 'Não'],
    scores: { Sim: 1, Não: 0 },
  },
  {
    id: 'pain',
    question: 'Qual sua maior dor operacional?',
    options: ['Briefing', 'Roteiro', 'Planejamento', 'Relatórios', 'Todas'],
    scores: { Briefing: 1, Roteiro: 1, Planejamento: 1, Relatórios: 1, Todas: 2 },
  },
  {
    id: 'timeline',
    question: 'Quando você precisa começar a ver resultados?',
    options: ['Urgente', '1-3 meses', 'Ainda pesquisando'],
    scores: { Urgente: 2, '1-3 meses': 2, 'Ainda pesquisando': 0 },
  },
];

const QUALIFICATION_THRESHOLD = 5;

export function useQualification() {
  const [state, setState] = useState<QuizState>({
    step: 0,
    answers: [],
    score: 0,
    isQualified: null,
    isComplete: false,
  });

  const answer = useCallback((option: string) => {
    setState((prev) => {
      const question = QUESTIONS[prev.step];
      const points = question.scores[option as keyof typeof question.scores] || 0;
      const newAnswers = [...prev.answers, { question: question.question, answer: option }];
      const newScore = prev.score + points;
      const nextStep = prev.step + 1;
      const isComplete = nextStep >= QUESTIONS.length;
      const isQualified = isComplete ? newScore >= QUALIFICATION_THRESHOLD : null;

      return {
        step: isComplete ? prev.step : nextStep,
        answers: newAnswers,
        score: newScore,
        isQualified,
        isComplete,
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState({
      step: 0,
      answers: [],
      score: 0,
      isQualified: null,
      isComplete: false,
    });
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.step === 0) return prev;
      const newAnswers = prev.answers.slice(0, -1);
      const question = QUESTIONS[prev.step - 1];
      const removedAnswer = prev.answers[prev.answers.length - 1]?.answer;
      const points = removedAnswer
        ? question.scores[removedAnswer as keyof typeof question.scores] || 0
        : 0;
      return {
        ...prev,
        step: prev.step - 1,
        answers: newAnswers,
        score: prev.score - points,
        isQualified: null,
        isComplete: false,
      };
    });
  }, []);

  const currentQuestion = QUESTIONS[state.step] || null;
  const progress = (state.step / QUESTIONS.length) * 100;

  return {
    state,
    currentQuestion,
    progress,
    answer,
    reset,
    goBack,
    totalQuestions: QUESTIONS.length,
  };
}
