'use client';

import dynamic from 'next/dynamic';

export default dynamic(() => import('./MapView.client'), { ssr: false });
