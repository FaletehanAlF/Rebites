
import { Bike, ShieldCheck, Sparkles } from 'lucide-react';

const BADGES = [
  { icon: Sparkles, label: 'Dikemas Rapi' },
  { icon: ShieldCheck, label: 'Higienis' },
  { icon: Bike, label: 'Ambil Sendiri di Lokasi Mitra' },
];

export function TrustBadges() {
  return (
    <div className="flex flex-wrap gap-2">
      {BADGES.map(({ icon: Icon, label }) => (
        <span
          key={label}
          className="inline-flex items-center gap-1.5 rounded-full border border-sage-100 bg-cream-100 px-4 py-2 text-xs font-medium text-charcoal-900"
        >
          <Icon className="h-3.5 w-3.5 text-primary" />
          {label}
        </span>
      ))}
    </div>
  );
}
