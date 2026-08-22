import { Table as UiTable, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Inbox } from 'lucide-react';

export default function Table({ columns, rows, emptyMessage = 'No records found.' }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
        <Inbox className="size-6 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border">
      <UiTable>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead key={col.key}>{col.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow key={row.id || idx}>
              {columns.map((col) => (
                <TableCell key={col.key}>{col.render ? col.render(row) : row[col.key]}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </UiTable>
    </div>
  );
}
