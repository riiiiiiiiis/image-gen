'use client';

interface PaginationControlsProps {
  currentPage: number;
  pageCount: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export function PaginationControls({
  currentPage,
  pageCount,
  canPreviousPage,
  canNextPage,
  onPreviousPage,
  onNextPage,
}: PaginationControlsProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onPreviousPage}
        disabled={!canPreviousPage}
        className="btn-secondary"
      >
        ← PREV
      </button>
      <span className="flex items-center px-3 text-sm text-gray-400">
        Page {currentPage} of {pageCount}
      </span>
      <button
        onClick={onNextPage}
        disabled={!canNextPage}
        className="btn-secondary"
      >
        NEXT →
      </button>
    </div>
  );
}