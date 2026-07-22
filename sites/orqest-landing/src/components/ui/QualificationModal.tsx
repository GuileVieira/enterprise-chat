'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import { useQualification } from '@/hooks/useQualification';
import { WEBHOOK_URL } from '@/lib/analytics';

interface QualificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QualificationModal({ open, onOpenChange }: QualificationModalProps) {
  const { state, currentQuestion, progress, answer, reset, goBack, totalQuestions } =
    useQualification();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAnswer = async (option: string) => {
    const nextStep = state.step + 1;
    const willComplete = nextStep >= totalQuestions;

    answer(option);

    if (willComplete) {
      setIsSubmitting(true);
      if (WEBHOOK_URL) {
        try {
          await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              answers: [
                ...state.answers,
                { question: currentQuestion?.question || '', answer: option },
              ],
              score:
                state.score +
                (currentQuestion?.scores[option as keyof typeof currentQuestion.scores] || 0),
              timestamp: new Date().toISOString(),
              source: window.location.href,
            }),
          });
        } catch {
          // The quiz should still complete if the tracking endpoint is unavailable.
        }
      }
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#1b1a17]/35 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="bg-surface-raised/95 fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-black/10 p-8 shadow-[0_25px_70px_-28px_rgba(67,61,52,0.45)] backdrop-blur-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          {/* Progress */}
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-text-muted font-mono text-xs">
                {state.isComplete ? 'Concluído' : `Passo ${state.step + 1} de ${totalQuestions}`}
              </span>
              <span className="text-text-muted font-mono text-xs">{Math.round(progress)}%</span>
            </div>
            <div className="bg-surface-raised h-1 overflow-hidden rounded-full">
              <motion.div
                className="h-full rounded-full bg-text-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ type: 'spring', stiffness: 100, damping: 20 }}
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!state.isComplete ? (
              <motion.div
                key={state.step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              >
                {currentQuestion && (
                  <>
                    <h3 className="mb-6 text-xl font-semibold tracking-tight text-text-primary">
                      {currentQuestion.question}
                    </h3>
                    {isSubmitting && (
                      <div className="bg-surface-raised mb-4 space-y-2 rounded-xl border border-black/10 p-4">
                        <div className="h-3 w-2/3 animate-pulse rounded bg-black/10" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-black/10" />
                      </div>
                    )}
                    <div className="space-y-3">
                      {currentQuestion.options.map((option) => (
                        <motion.button
                          key={option}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => handleAnswer(option)}
                          disabled={isSubmitting}
                          className="bg-surface hover:bg-surface-raised w-full rounded-xl border border-black/10 p-4 text-left text-sm font-medium text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {option}
                        </motion.button>
                      ))}
                    </div>
                    {state.step > 0 && (
                      <button
                        onClick={goBack}
                        className="text-text-muted mt-4 rounded-lg px-2 py-1 text-xs transition-colors hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        Voltar
                      </button>
                    )}
                  </>
                )}
              </motion.div>
            ) : state.isQualified ? (
              <motion.div
                key="qualified"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="text-center"
              >
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12L10 17L19 8"
                      stroke="#9ea36a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-semibold tracking-tight text-text-primary">
                  Você é um ótimo fit para a Orqest
                </h3>
                <p className="mb-8 text-sm text-text-secondary">
                  Baseado nas suas respostas, sua agência tem o perfil ideal para beneficiar dos
                  agentes de IA.
                </p>
                <a
                  href="https://cal.com/orqest/diagnostico"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:bg-accent-hover inline-flex items-center justify-center rounded-full bg-text-primary px-8 py-4 text-sm font-medium text-background transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
                >
                  Agendar minha reunião
                </a>
              </motion.div>
            ) : (
              <motion.div
                key="not-qualified"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="text-center"
              >
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 8V12M12 16H12.01"
                      stroke="#fbbf24"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-semibold tracking-tight text-text-primary">
                  Ainda não é o momento ideal
                </h3>
                <p className="mb-4 text-sm text-text-secondary">
                  Parece que sua operação ainda não está no estágio ideal para a Orqest. Mas podemos
                  ajudar.
                </p>
                <p className="mb-8 text-sm text-text-secondary">
                  Baixe nosso guia de processos operacionais para agências e comece a organizar sua
                  operação hoje.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    disabled
                    className="bg-text-primary/60 inline-flex cursor-not-allowed items-center justify-center rounded-full px-8 py-4 text-sm font-medium text-background opacity-70"
                  >
                    Guia enviado após o diagnóstico
                  </button>
                  <a
                    href="https://cal.com/orqest/diagnostico"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-surface-raised inline-flex items-center justify-center rounded-full border border-black/10 px-8 py-4 text-sm font-medium text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Falar mesmo assim
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
