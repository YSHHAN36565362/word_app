"use client";

import { ReactNode } from "react";

interface FlashCardProps {
  flipped: boolean;
  front: ReactNode;
  back: ReactNode;
  minHeight?: number;
}

export default function FlashCard({ flipped, front, back, minHeight = 220 }: FlashCardProps) {
  return (
    <div className="flip-scene w-full">
      <div className={`flip-card w-full ${flipped ? "flipped" : ""}`} style={{ minHeight }}>
        <div className="flip-face study-card w-full h-full flex items-center justify-center p-6">{front}</div>
        <div className="flip-face flip-face-back study-card w-full h-full flex items-center justify-center p-6">
          {back}
        </div>
      </div>
    </div>
  );
}
