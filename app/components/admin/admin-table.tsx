'use client';
import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useAdminPreferences } from '@/hooks/use-admin-preferences';
function selPadang(compact: boolean) {
    return compact ? 'py-2.5' : 'py-4';
}
export function AdminTr({ children, className, ...props }: TdHTMLAttributes<HTMLTableRowElement>) {
    const { compactTable, tableRowHover } = useAdminPreferences();
    return (<tr className={cn('border-b border-admin-line/70 align-top transition-colors last:border-0', tableRowHover && 'hover:bg-admin-surface-hover', className)} {...props}>
      {children}
    </tr>);
}
export function AdminTd({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
    const { compactTable } = useAdminPreferences();
    return (<td className={cn('px-4 text-sm leading-relaxed text-charcoal-700', selPadang(compactTable), className)} {...props}>
      {children}
    </td>);
}
export function AdminTdPrimary({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
    const { compactTable } = useAdminPreferences();
    return (<td className={cn('px-4 text-sm font-medium leading-relaxed text-charcoal-900', selPadang(compactTable), className)} {...props}>
      {children}
    </td>);
}
export function AdminTdCode({ children, className, title, }: {
    children: ReactNode;
    className?: string;
    title?: string;
}) {
    const { compactTable } = useAdminPreferences();
    return (<td title={title} className={cn('whitespace-nowrap px-4 font-mono text-xs font-semibold text-charcoal-900', selPadang(compactTable), className)}>
      {children}
    </td>);
}
export function AdminTdActions({ children }: {
    children: ReactNode;
}) {
    const { compactTable } = useAdminPreferences();
    return (<td className={cn('whitespace-nowrap px-4 text-right align-middle', selPadang(compactTable))}>
      <div className="flex items-center justify-end gap-2">{children}</div>
    </td>);
}
export function AdminTrDetail({ children, colSpan, id, }: {
    children: ReactNode;
    colSpan: number;
    id?: string;
}) {
    return (<tr id={id} className="border-b border-admin-line/70 bg-admin-surface last:border-0 hover:bg-admin-surface-hover">
      <td colSpan={colSpan} className="px-4 py-4">
        {children}
      </td>
    </tr>);
}
export function AdminTableCard({ children, className, label, minWidth = 880, }: {
    children: ReactNode;
    className?: string;
    label?: string;
    minWidth?: number;
}) {
    return (<div className={cn('overflow-hidden rounded-xl border border-admin-line/80 bg-admin-panel shadow-admin-card', className)}>
      <div className="w-full overflow-x-auto overscroll-x-contain">
        <table aria-label={label} className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </div>);
}
export function AdminTableHead({ children }: {
    children: ReactNode;
}) {
    return (<thead className="bg-admin-surface">
      <tr className="border-b border-admin-line/70">{children}</tr>
    </thead>);
}
export function AdminTh({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
    return (<th scope="col" className={cn('whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase leading-4 tracking-[0.08em] text-charcoal-700', className)} {...props}>
      {children}
    </th>);
}
export function AdminTableCaption({ title, description, actions, }: {
    title: string;
    description?: string;
    actions?: ReactNode;
}) {
    return (<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        
        <h2 className="font-display text-[15px] font-semibold text-charcoal-900">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-xs text-sage-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>);
}
