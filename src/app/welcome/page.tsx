'use client';

import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthContext } from '@/context/AuthContext';

const Firework = ({ delay, left, top }: { delay: number; left: string; top: string }) => {
  const numExplosions = 30;
  
  const explosionParticles = useMemo(() => {
    return Array.from({ length: numExplosions }).map((_, i) => {
      const angle = (i / numExplosions) * 360;
      const x = Math.cos((angle * Math.PI) / 180) * 100 + (Math.random() - 0.5) * 40;
      const y = Math.sin((angle * Math.PI) / 180) * 100 + (Math.random() - 0.5) * 40;
      const randomColorClass = `r${Math.ceil(Math.random() * 6)}`;
      
      return (
        <div
          key={i}
          className={`explosion ${randomColorClass}`}
          style={{
            transform: `translate(${x}px, ${y}px)`,
            animationDelay: `${delay + 3}s`,
          }}
        />
      );
    });
  }, [delay]);

  return (
    <div
      className="firework"
      style={{ left, top, animationDelay: `${delay}s` }}
    >
      {explosionParticles}
    </div>
  );
};

const WelcomePage = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthContext();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/');
    }, 4000); // 4 seconds for the animation

    return () => clearTimeout(timer);
  }, [router]);

  if (isLoading || !isAuthenticated) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-black">
            <p className="text-white">Loading...</p>
        </div>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-black overflow-hidden relative">
      <div className="z-10 flex flex-col items-center text-center">
        <Image
          src="https://i.postimg.cc/d11JgxLq/Picture1.png"
          alt="Align Fabrics & Curtains Logo"
          width={180}
          height={180}
          className="rounded-lg shadow-2xl shadow-red-900/50 mb-8 animate-pulse"
          priority
        />
        <h2 className="text-3xl md:text-4xl text-white/80 tracking-wide animate-typing welcome-text mx-auto w-[11ch]">
          Welcome to
        </h2>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-wider mt-2 animate-typing company-name mx-auto w-[25ch]">
          Align Fabrics & Curtains
        </h1>
      </div>

      {/* More Fireworks */}
      <Firework delay={0} left="10%" top="20%" />
      <Firework delay={0.3} left="85%" top="30%" />
      <Firework delay={0.6} left="50%" top="10%" />
      <Firework delay={0.9} left="25%" top="60%" />
      <Firework delay={1.2} left="75%" top="70%" />
      <Firework delay={1.5} left="5%" top="80%" />
      <Firework delay={1.8} left="95%" top="55%" />
      <Firework delay={2.1} left="40%" top="45%" />

    </main>
  );
};

export default WelcomePage;
