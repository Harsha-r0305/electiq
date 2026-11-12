'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ForYou() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/courses');
  }, [router]);
  return null;
}
