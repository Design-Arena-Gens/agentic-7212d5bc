'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const FPSCanvas = dynamic(() => import('./FPSCanvas').then((mod) => mod.FPSCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-200">
      Loading immersive scene…
    </div>
  ),
});

export function FPSExperience() {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const handleLockChange = () => {
      const { pointerLockElement } = document;
      setLocked(Boolean(pointerLockElement));
    };

    document.addEventListener('pointerlockchange', handleLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', handleLockChange);
    };
  }, []);

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-slate-950">
      <FPSCanvas />
      <div
        id="fps-overlay"
        className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${
          locked ? 'pointer-events-none opacity-0' : 'cursor-pointer opacity-100'
        }`}
      >
        <div className="rounded-lg border border-slate-600/60 bg-slate-900/85 px-10 py-8 text-center text-slate-200 backdrop-blur">
          <h1 className="mb-4 text-2xl font-semibold tracking-wide text-white">Neo District Recon</h1>
          <p className="mb-6 text-sm text-slate-300">
            Click to enter the visor. Use <span className="font-semibold text-sky-300">WASD</span> to move,
            <span className="font-semibold text-sky-300"> Shift</span> to sprint, and
            <span className="font-semibold text-sky-300"> Space</span> to jump.
          </p>
          <span className="rounded-full border border-sky-400/50 px-4 py-2 text-xs uppercase tracking-[0.3em] text-sky-200">
            Engage
          </span>
        </div>
      </div>
    </div>
  );
}
