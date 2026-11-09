'use client';
import { CircleCheck } from 'lucide-react';
import { StaggerGroup, StaggerItem } from './anim';
export function PackageContents({ items }: {
    items: string[];
}) {
    return (<div>
      <h3 className="font-sans text-xl font-bold tracking-tight text-primary">
        Isi Paket
      </h3>
      <StaggerGroup as="ul" className="mt-4 space-y-2.5" stagger={0.06}>
        {items.map((item) => (<StaggerItem key={item} as="li">
            <span className="flex items-start gap-3 font-secondary text-sm leading-relaxed text-muted-foreground">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary"/>
              {item}
            </span>
          </StaggerItem>))}
      </StaggerGroup>
    </div>);
}
