'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/stores';

export function LoadingScreen() {
  const loaded = useAppStore(s => s.loaded);
  const loadProgress = useAppStore(s => s.loadProgress);

  if (loaded) return null;

  return (
    <AnimatePresence>
      {!loaded && (
        <motion.div
          className="loading-screen"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Background stars */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            {Array.from({ length: 60 }).map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                width: Math.random() * 2 + 1,
                height: Math.random() * 2 + 1,
                background: 'white',
                borderRadius: '50%',
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.7 + 0.3,
                animation: `pulseGlow ${2 + Math.random() * 3}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 2}s`,
              }} />
            ))}
          </div>

          {/* Earth visualization */}
          <motion.div
            className="loading-earth"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />

          {/* Title */}
          <motion.div
            className="loading-title"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            Earth Explorer
          </motion.div>

          <motion.div
            className="loading-subtitle"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            Digital Twin of Planet Earth
          </motion.div>

          {/* Progress bar */}
          <motion.div
            className="loading-bar-track"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <div className="loading-bar-fill" style={{ width: `${loadProgress}%` }} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            style={{ marginTop: 12, fontSize: 12, color: '#64748b', fontFamily: 'JetBrains Mono' }}
          >
            {loadProgress < 30 ? 'Initializing renderer...' :
             loadProgress < 60 ? 'Loading Earth textures...' :
             loadProgress < 80 ? 'Computing satellite orbits...' :
             loadProgress < 95 ? 'Populating flight data...' :
             'Ready for launch!'}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function GlassCard({ children, className = '', style = {}, onClick, ...props }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div className={`glass-card ${className}`} style={style} onClick={onClick} {...props}>
      {children}
    </div>
  );
}
