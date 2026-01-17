import React, { createContext, useContext, useRef, useState, useEffect } from 'react';

/**
 * Shared AudioContext Provider
 * Allows AudioFilter and AudioAnalysis to share the same AudioContext
 */

const AudioContextContext = createContext(null);

export function AudioContextProvider({ children, audioRef }) {
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize shared AudioContext
  const initializeAudioContext = () => {
    if (audioContextRef.current || !audioRef) return;

    try {
      // Wait for audio to be ready
      if (audioRef.readyState < 2) {
        console.log('⏳ Waiting for audio to load...');
        setTimeout(initializeAudioContext, 500);
        return;
      }

      console.log('🎵 Creating shared AudioContext...');

      // Create AudioContext
      const context = new (window.AudioContext || window.webkitAudioContext)();

      // Create MediaElementSource (only once!)
      const sourceNode = context.createMediaElementSource(audioRef);

      audioContextRef.current = context;
      sourceNodeRef.current = sourceNode;
      setIsInitialized(true);

      console.log('✅ Shared AudioContext created successfully');

    } catch (err) {
      console.error('❌ Failed to create shared AudioContext:', err);
    }
  };

  // Initialize on mount and when audioRef changes
  useEffect(() => {
    if (audioRef) {
      const handleLoadedData = () => {
        if (!isInitialized) {
          initializeAudioContext();
        }
      };

      audioRef.addEventListener('loadeddata', handleLoadedData);

      // Try immediate initialization
      if (audioRef.readyState >= 2) {
        initializeAudioContext();
      }

      return () => {
        audioRef.removeEventListener('loadeddata', handleLoadedData);
      };
    }
  }, [audioRef]);

  const value = {
    audioContext: audioContextRef.current,
    sourceNode: sourceNodeRef.current,
    isInitialized,
  };

  return (
    <AudioContextContext.Provider value={value}>
      {children}
    </AudioContextContext.Provider>
  );
}

export function useAudioContext() {
  const context = useContext(AudioContextContext);
  if (!context) {
    throw new Error('useAudioContext must be used within AudioContextProvider');
  }
  return context;
}