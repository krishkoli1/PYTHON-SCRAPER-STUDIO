import React from 'react';

interface StepIndicatorProps {
  currentStep: number;
  steps: string[];
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, steps }) => {
  if (steps.length === 0) return null;

  return (
    <nav aria-label="Progress">
      <ol role="list" className="flex items-center">
        {steps.map((stepName, index) => {
          const stepNumber = index + 1;
          const isCompleted = currentStep > stepNumber;
          const isCurrent = currentStep === stepNumber;

          return (
            <li key={stepName} className={`relative ${index !== steps.length - 1 ? 'pr-12 sm:pr-24' : ''}`}>
              {isCompleted ? (
                <>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="h-0.5 w-full bg-white" />
                  </div>
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white hover:bg-zinc-200">
                    <svg className="h-5 w-5 text-black" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z" clipRule="evenodd" />
                    </svg>
                  </div>
                </>
              ) : isCurrent ? (
                <>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="h-0.5 w-full bg-zinc-700" />
                  </div>
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-black" aria-current="step">
                    <span className="h-2.5 w-2.5 rounded-full bg-white" aria-hidden="true" />
                  </div>
                </>
              ) : (
                <>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="h-0.5 w-full bg-zinc-700" />
                  </div>
                  <div className="group relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-zinc-600 bg-black hover:border-zinc-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-transparent group-hover:bg-zinc-700" aria-hidden="true" />
                  </div>
                </>
              )}
              <div className="absolute -bottom-7 w-max text-center text-xs font-medium text-zinc-400">{stepName}</div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};