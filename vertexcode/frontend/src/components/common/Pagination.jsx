import { ChevronLeft, ChevronRight } from 'lucide-react';

// Shared server-side pagination control — expects `meta` in the shape
// returned by sendSuccess(res, status, data, { total, page, limit }).
// `onPageSizeChange` is optional — pass it (with `pageSizeOptions`) to also
// render a page-size selector inline; every existing caller that doesn't
// pass it renders exactly as before.
export default function Pagination({ meta, onPageChange, onPageSizeChange, pageSizeOptions }) {
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
      {onPageSizeChange && (
        <label className="pagination-page-size">
          Rows per page
          <select value={limit} onChange={(e) => onPageSizeChange(Number(e.target.value))} aria-label="Rows per page">
            {(pageSizeOptions || [10, 25, 50]).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
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
