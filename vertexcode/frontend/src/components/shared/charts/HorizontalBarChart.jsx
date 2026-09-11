import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

const PALETTE = [
  'var(--color-primary)',
  'var(--color-info)',
  'var(--color-purple)',
  'var(--color-success)',
  'var(--color-warning)',
];

const tooltipStyle = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 12,
  boxShadow: 'var(--shadow-md)',
};

// New, separate from BarChart.jsx (already used by AdminDashboard) so that
// page is unaffected — recharts' horizontal layout (categories on the Y
// axis) reads better for a short, named category breakdown than vertical
// bars do.
export default function HorizontalBarChart({ data, dataKey, nameKey, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey={nameKey}
          tick={{ fontSize: 12, fill: 'var(--color-foreground)' }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--color-muted)' }} />
        <Bar dataKey={dataKey} radius={[0, 6, 6, 0]} maxBarSize={28}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}
