import { Inbox } from 'lucide-react';

export default function DataTable({ columns, rows, emptyMessage = 'No records found.', loading = false }) {
  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }
  if (!rows || rows.length === 0) {
    return (
      <div className="empty-state">
        <Inbox size={24} />
        <span>{emptyMessage}</span>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.align === 'right' ? 'col-num' : col.align === 'actions' ? 'col-actions' : undefined}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id || idx}>
              {columns.map((col) => (
                <td key={col.key} className={col.align === 'right' ? 'col-num' : col.align === 'actions' ? 'col-actions' : undefined}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
