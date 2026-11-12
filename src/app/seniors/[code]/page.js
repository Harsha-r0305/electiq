'use client';
import { useRouter } from 'next/navigation';
import SeniorProfileModal from '@/components/SeniorProfileModal';

export default function SeniorPage({ params }) {
  const router = useRouter();
  const code = params.code;

  return (
    <div style={{ minHeight: '80vh' }}>
      <SeniorProfileModal seniorCode={code} onClose={() => router.push('/seniors')} />
    </div>
  );
}

