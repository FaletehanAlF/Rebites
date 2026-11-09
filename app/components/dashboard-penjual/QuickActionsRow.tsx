import Link from 'next/link';
import { Plus, ShoppingBag } from 'lucide-react';
import { useStoreRouteId } from '@/hooks/use-store-route-id';
import { sellerStorePath } from '@/lib/seller-store-path';
const actions = [
    { label: 'Tambah Menu', icon: Plus, sub: 'tambahMenu' },
    { label: 'Pesanan Masuk', icon: ShoppingBag, sub: 'pesanan' },
] as const;
type Action = (typeof actions)[number];
function ActionContent({ action }: {
    action: Action;
}) {
    const Icon = action.icon;
    return (<>

      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-primary transition-colors group-hover:bg-muted/70">

        <Icon className="h-5 w-5"/>

      </span>

      <span className="text-center text-[11px] font-medium text-foreground">

        {action.label}

      </span>

    </>);
}
export function QuickActionsRow() {
    const storeId = useStoreRouteId();
    return (<div className="mt-5 grid grid-cols-2 gap-3">

      {actions.map((action) => (<Link key={action.label} href={sellerStorePath(storeId, action.sub)} aria-label={action.label} className="group flex flex-col items-center gap-1.5">

          <ActionContent action={action}/>

        </Link>))}

    </div>);
}
