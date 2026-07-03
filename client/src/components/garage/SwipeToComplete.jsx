import { useState, useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { FiArrowRight, FiCheckCircle } from "react-icons/fi";

export default function SwipeToComplete({ onComplete }) {
  const [isComplete, setIsComplete] = useState(false);
  const x = useMotionValue(0);
  const xSpring = useSpring(x, { stiffness: 500, damping: 50 });
  const containerRef = useRef(null);
  const maxDrag = 280;

  const handleDragEnd = (_, info) => {
    if (info.offset.x >= maxDrag - 40) {
      setIsComplete(true);
      setTimeout(() => {
        onComplete?.();
      }, 1500);
    }
  };

  if (isComplete) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex items-center justify-center gap-3 py-4 bg-brand rounded-2xl"
      >
        <FiCheckCircle className="w-8 h-8 text-black" />
        <span className="text-xl font-bold text-black">
          Service Completed Successfully!
        </span>
      </motion.div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-16 bg-ink rounded-full overflow-hidden"
    >
      <div className="absolute inset-0 flex items-center justify-center text-white font-semibold opacity-60">
        Swipe to Complete Service
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: maxDrag }}
        dragElastic={0}
        style={{ x: xSpring }}
        onDragEnd={handleDragEnd}
        className="absolute left-2 top-2 bottom-2 flex items-center gap-3 px-4 bg-brand rounded-full cursor-grab active:cursor-grabbing"
      >
        <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center">
          <FiArrowRight className="w-5 h-5 text-black" />
        </div>
        <span className="text-black font-bold whitespace-nowrap">
          Complete Service
        </span>
      </motion.div>
    </div>
  );
}
