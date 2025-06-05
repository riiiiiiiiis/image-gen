'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface BatchActionMenuProps {
  triggerButtonLabel: string;
  triggerButtonIcon: React.ReactNode;
  menuTitle: string;
  countInputState: [string, (value: string) => void];
  onCustomCountAction: (count: number) => void;
  customCountActionLabel: (count: string) => string;
  onAllEligibleAction?: () => void;
  allEligibleActionLabel?: string;
  getEligibleCount?: () => number;
  className?: string;
}

export function BatchActionMenu({
  triggerButtonLabel,
  triggerButtonIcon,
  menuTitle,
  countInputState,
  onCustomCountAction,
  customCountActionLabel,
  onAllEligibleAction,
  allEligibleActionLabel,
  getEligibleCount,
  className = ''
}: BatchActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customCount, setCustomCount] = countInputState;
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCustomAction = () => {
    const count = parseInt(customCount, 10);
    if (count > 0) {
      onCustomCountAction(count);
      setIsOpen(false);
    }
  };

  const handleAllEligibleAction = () => {
    if (onAllEligibleAction) {
      onAllEligibleAction();
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-primary flex items-center gap-2"
      >
        {triggerButtonIcon}
        {triggerButtonLabel}
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-10">
          <div className="p-2">
            <div className="mb-2">
              <div className="text-xs text-gray-400 mb-1">{menuTitle}</div>
              <input
                type="number"
                value={customCount}
                onChange={(e) => setCustomCount(e.target.value)}
                placeholder="Number of items"
                className="input-field w-full text-sm px-3 py-2"
                min="1"
                aria-label={menuTitle}
              />
              <button
                onClick={handleCustomAction}
                disabled={!customCount || parseInt(customCount, 10) <= 0}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              >
                {customCountActionLabel(customCount)}
              </button>
            </div>
            
            {onAllEligibleAction && allEligibleActionLabel && (
              <>
                <div className="border-t border-gray-700 my-2"></div>
                <button
                  onClick={handleAllEligibleAction}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-800 rounded transition-colors"
                >
                  {allEligibleActionLabel}
                  {getEligibleCount && (
                    <span> ({getEligibleCount()})</span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}