'use client';

import { useEffect, useState } from 'react';
import { MapPin, Navigation, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props {
  orderCode: string;
  destination?: { latitude: number | null; longitude: number | null } | null;
}

interface LocationPayload {
  latitude: number;
  longitude: number;
  updatedAt: string;
}

export function DeliveryLiveTracking({ orderCode, destination }: Props) {
  const [location, setLocation] = useState<LocationPayload | null>(null);
  const [status, setStatus] = useState<'waiting' | 'live' | 'unavailable'>('waiting');

  useEffect(() => {
    if (!orderCode) return;
    const channel = supabase.channel(`delivery:${orderCode}`, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'location' }, (payload) => {
      const data = payload.payload as LocationPayload | undefined;
      if (data && Number.isFinite(data.latitude) && Number.isFinite(data.longitude)) {
        setLocation(data);
        setStatus('live');
      }
    });

    channel.subscribe((state) => {
      if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
        setStatus('unavailable');
      }
    });

    // Timeout: jika 20 detik tidak ada lokasi, tandai unavailable.
    const timeout = window.setTimeout(() => {
      setStatus((prev) => (prev === 'waiting' ? 'unavailable' : prev));
    }, 20000);

    return () => {
      window.clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [orderCode]);

  const mapSrc =
    location &&
    `https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude - 0.01},${location.latitude - 0.01},${location.longitude + 0.01},${location.latitude + 0.01}&layer=mapnik&marker=${location.latitude},${location.longitude}`;

  return (
    <div className="mt-3 rounded-xl bg-purple-50 px-4 py-3 ring-1 ring-purple-100">
      <div className="flex items-center gap-2">
        <Navigation className="h-4 w-4 text-purple-600" />
        <p className="text-sm font-semibold text-purple-700">Lacak Kurir (Live)</p>
      </div>
      {status === 'waiting' && (
        <p className="mt-1 text-xs text-purple-600">Menunggu lokasi kurir…</p>
      )}
      {status === 'unavailable' && (
        <p className="mt-1 text-xs text-purple-600">
          Lokasi kurir tidak tersedia (GPS/izin/koneksi). Coba lagi nanti.
        </p>
      )}
      {location && (
        <>
          <p className="mt-1 text-xs text-purple-600">
            Terakhir diperbarui:{' '}
            {new Date(location.updatedAt).toLocaleTimeString('id-ID')}
          </p>
          <div className="mt-2 overflow-hidden rounded-lg ring-1 ring-purple-100">
            <iframe
              title="Lokasi kurir"
              src={mapSrc!}
              className="h-48 w-full border-0"
              loading="lazy"
            />
          </div>
          <p className="mt-1 text-[10px] text-purple-500">
            {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
          </p>
        </>
      )}
      {destination?.latitude != null && destination?.longitude != null && (
        <p className="mt-1 flex items-center gap-1 text-[10px] text-purple-500">
          <MapPin className="h-3 w-3" />
          Tujuan: {Number(destination.latitude).toFixed(5)}, {Number(destination.longitude).toFixed(5)}
        </p>
      )}
    </div>
  );
}
