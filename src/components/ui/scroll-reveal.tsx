import { useEffect, useRef, useState, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ScrollRevealProps {
  children?: ReactNode;
  className?: string;
  animation?: "fade-up" | "fade-in" | "zoom-in" | "fade-left" | "fade-right";
  delay?: number;
  duration?: number;
}

export function ScrollReveal({ 
  children, 
  className,
  animation = "fade-up",
  delay = 0,
  duration = 700
}: ScrollRevealProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      },
      {
        threshold: 0.1, // Trigger when 10% visible
        rootMargin: "0px 0px -50px 0px", // Trigger slightly before it comes fully into view from bottom
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  // Determine base and active classes based on animation type
  let baseClass = "opacity-0 transition-all ease-out";
  let activeClass = "opacity-100";
  
  if (animation === "fade-up") {
    baseClass += " translate-y-12";
    activeClass += " translate-y-0";
  } else if (animation === "fade-left") {
    baseClass += " -translate-x-12";
    activeClass += " translate-x-0";
  } else if (animation === "fade-right") {
    baseClass += " translate-x-12";
    activeClass += " translate-x-0";
  } else if (animation === "fade-in") {
    // Only opacity change
  } else if (animation === "zoom-in") {
    baseClass += " scale-95";
    activeClass += " scale-100";
  }

  return (
    <div
      ref={ref}
      style={{ 
        transitionDelay: `${delay}ms`,
        transitionDuration: `${duration}ms`
      }}
      className={cn(baseClass, isVisible && activeClass, className)}
    >
      {children}
    </div>
  );
}
