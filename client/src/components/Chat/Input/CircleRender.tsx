import React from 'react';

interface CircleRenderProps {
  rmsLevel: number;
  isCameraOn: boolean;
  state?: string;
}

const CircleRender = ({ rmsLevel, isCameraOn, state }: CircleRenderProps) => {
  const getIconComponent = (callState?: string) => {
    switch (callState) {
      case 'thinking':
      case 'Thinking':
        return <CircleDotsIcon />;
      default:
        return (
          <div className="smooth-transition" style={{ transform: `scale(${transformScale})` }}>
            <CircleIcon state={callState} />
          </div>
        );
    }
  };

  const baseScale = isCameraOn ? 0.5 : 1;
  const scaleMultiplier =
    rmsLevel > 0.08
      ? 1.8
      : rmsLevel > 0.07
        ? 1.6
        : rmsLevel > 0.05
          ? 1.4
          : rmsLevel > 0.01
            ? 1.2
            : 1;

  const transformScale = baseScale * scaleMultiplier;

  return getIconComponent(state);
};

export default CircleRender;

function CircleDotsIcon() {
  return (
    <div className="flex h-64 w-64 items-center justify-center gap-3 rounded-full border border-border-light">
      <span className="h-3 w-3 rounded-full bg-text-primary" />
      <span className="h-3 w-3 rounded-full bg-text-primary" />
      <span className="h-3 w-3 rounded-full bg-text-primary" />
    </div>
  );
}

function CircleIcon({ state }: { state?: string }) {
  return (
    <div
      className="h-64 w-64 rounded-full border border-border-light bg-surface-secondary"
      data-call-state={state}
    />
  );
}
