import { Badge } from '@/app/components/ui/badge';
import { SHIPMENT_STATE_LABEL, type ShipmentState } from '@/lib/shipment-state';
const STATE_BADGE_VARIANT: Record<ShipmentState, 'success' | 'warning' | 'destructive' | 'secondary'> = {
    to_ship: 'warning',
    in_transit: 'secondary',
    late: 'destructive',
    done: 'success',
    inactive: 'secondary',
};
export function ShipmentStateBadge({ state }: {
    state: ShipmentState;
}) {
    return (<Badge variant={STATE_BADGE_VARIANT[state]}>
      {SHIPMENT_STATE_LABEL[state]}
    </Badge>);
}
