"use client";

import { Search, ChevronLeft, ChevronRight } from "lucide-react";

interface SearchPaginationProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
}

export default function SearchPagination({
  searchValue,
  onSearchChange,
  placeholder = "Search...",
  page,
  totalPages,
  onPageChange,
  totalItems,
}: SearchPaginationProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
      <div className="relative flex-1 max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Search"
          className="w-full bg-dark-500 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
        />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">
            {totalItems} result{totalItems !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="p-1.5 rounded-md border border-white/10 text-gray-400 hover:text-white disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-gray-400" aria-live="polite">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="p-1.5 rounded-md border border-white/10 text-gray-400 hover:text-white disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
