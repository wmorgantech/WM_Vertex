import { ChevronLeft, ChevronRight } from 'lucide-react';

// Shared server-side pagination control — expects `meta` in the shape
// returned by sendSuccess(res, status, data, { total, page, limit }).
export default function Pagination({ meta, onPageChange }) {
  if (!meta || !meta.total) return null;

  const { total, page, limit } = meta;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <span className="pagination-summary">
        Showing {from}–{to} of {total}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          title="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="pagination-page">Page {page} of {totalPages}</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          title="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
