'use client';

import { createLeafletContext, LeafletProvider } from '@react-leaflet/core';
import { map, type LatLngExpression } from 'leaflet';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export default function LeafletMap({ center, zoom, className, style, children }: {
  center: LatLngExpression;
  zoom: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [initialView] = useState({ center, zoom });
  const [context, setContext] = useState<ReturnType<typeof createLeafletContext> | null>(null);

  useEffect(() => {
    if (!element.current) return;
    const instance = map(element.current).setView(initialView.center, initialView.zoom);
    setContext(createLeafletContext(instance));
    return () => { instance.remove(); };
  }, [initialView]);

  return <div ref={element} className={className} style={style}>
    {context && <LeafletProvider value={context}>{children}</LeafletProvider>}
  </div>;
}
