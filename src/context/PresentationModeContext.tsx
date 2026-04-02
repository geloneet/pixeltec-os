'use client';

import React, { createContext, useState, useContext, useMemo } from 'react';

interface PresentationModeContextType {
  isPresentationMode: boolean;
  setPresentationMode: React.Dispatch<React.SetStateAction<boolean>>;
}

const PresentationModeContext = createContext<PresentationModeContextType | undefined>(undefined);

export function PresentationModeProvider({ children }: { children: React.ReactNode }) {
  const [isPresentationMode, setPresentationMode] = useState(false);

  const value = useMemo(() => ({
    isPresentationMode,
    setPresentationMode
  }), [isPresentationMode]);

  return (
    <PresentationModeContext.Provider value={value}>
      {children}
    </PresentationModeContext.Provider>
  );
}

export function usePresentationMode() {
  const context = useContext(PresentationModeContext);
  if (context === undefined) {
    throw new Error('usePresentationMode must be used within a PresentationModeProvider');
  }
  return context;
}
