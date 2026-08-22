import { PieChart as RePieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PALETTE = [
  'var(--color-primary)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-destructive)',
  'var(--color-purple)',
  'var(--color-info)',
  'var(--color-muted-foreground)',
];

const tooltipStyle = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 12,
  boxShadow: 'var(--shadow-md)',
};

export default function PieChart({ data, dataKey, nameKey, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RePieChart>
        <Pie data={data} dataKey={dataKey} nameKey={nameKey} outerRadius={90} innerRadius={52} paddingAngle={2}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} stroke="var(--color-card)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}
          formatter={(value) => <span className="text-muted-foreground">{value}</span>}
        />
      </RePieChart>
    </ResponsiveContainer>
  );
}
