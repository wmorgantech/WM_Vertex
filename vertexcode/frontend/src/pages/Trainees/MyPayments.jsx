import { useEffect, useState } from 'react';
import { IndianRupee, Wallet, CheckCircle2 } from 'lucide-react';
import api from '@/api/axios';
import PageHeader from '@/components/shared/PageHeader';
import Table from '@/components/shared/Table';
import KpiCard from '@/components/shared/KpiCard';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyPayments() {
  const [enrollment, setEnrollment] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/trainees/enrollments')
      .then(({ data }) => {
        const mine = data.data[0];
        if (!mine) return null;
        return api.get(`/trainees/enrollments/${mine.id}`).then(({ data: detail }) => {
          setEnrollment(detail.data);
          return api.get(`/trainees/enrollments/${mine.id}/payments`);
        });
      })
      .then((res) => { if (res) setPayments(res.data.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="space-y-6">
        <PageHeader title="Payments" subtitle="No training program enrollment on record yet." />
        <p className="text-sm text-muted-foreground">Contact an admin to be enrolled in a training program.</p>
      </div>
    );
  }

  const { payment } = enrollment;
  const columns = [
    { key: 'paymentDate', header: 'Date', render: (p) => new Date(p.paymentDate).toLocaleDateString() },
    { key: 'amount', header: 'Amount', render: (p) => `₹${p.amount.toLocaleString()}` },
    { key: 'paymentMode', header: 'Mode', render: (p) => p.paymentMode || '—' },
    { key: 'reference', header: 'Reference', render: (p) => p.reference || '—' },
    { key: 'notes', header: 'Notes', render: (p) => p.notes || '—' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" subtitle={enrollment.program.name} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Total Fee" value={`₹${payment.finalFee.toLocaleString()}`} icon={IndianRupee} accent="primary" />
        <KpiCard label="Total Paid" value={`₹${payment.totalPaid.toLocaleString()}`} icon={CheckCircle2} accent="success" />
        <KpiCard
          label="Balance Due"
          value={payment.balance > 0 ? `₹${payment.balance.toLocaleString()}` : 'Paid'}
          icon={Wallet}
          accent={payment.balance > 0 ? 'destructive' : 'success'}
        />
      </div>

      <Table columns={columns} rows={payments} emptyMessage="No payments recorded yet." />
    </div>
  );
}
