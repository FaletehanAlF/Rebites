# Component Architecture

> Component organization, shared vs actor-specific components, and UI patterns.

---

## Component Directory Structure

```
app/components/
├── admin/                 # Admin dashboard (protected)
│   ├── dashboard/         # Dashboard-specific widgets
│   │   ├── dashboard-kpi-grid.tsx
│   │   ├── dashboard-attention.tsx
│   │   ├── dashboard-monitoring.tsx
│   │   ├── dashboard-activity.tsx
│   │   ├── dashboard-analytics.tsx
│   │   ├── dashboard-visitors.tsx
│   │   ├── dashboard-summaries.tsx
│   │   ├── dashboard-skeleton.tsx
│   │   └── primitives.tsx
│   ├── admin-page-header.tsx
│   ├── admin-state.tsx
│   ├── admin-format.tsx
│   └── ...
├── auth/                  # Auth forms, guards, shells
│   ├── require-auth.tsx           # Guard component
│   ├── auth-split-shell.tsx       # Split-screen auth layout
│   ├── auth-form.tsx              # Unified login/register
│   ├── penjual-login-form.tsx
│   ├── penjual-register-form.tsx
│   ├── forgot-password-form.tsx
│   ├── buat-sandi-baru-form.tsx
│   └── ...
├── buyer/                 # Buyer-specific features
│   ├── order-history/
│   │   ├── order-history-list.tsx
│   │   ├── delivery-map.tsx
│   │   └── courier-chat.tsx
│   ├── makanan-category/
│   │   └── category-view.tsx
│   ├── profile/
│   │   ├── profile-avatar.tsx
│   │   └── profile-addresses.tsx
│   └── ...
├── chatbot/               # AI Chatbot (global widget)
│   ├── chatbot-widget.tsx       # Main widget (fixed bottom-right)
│   ├── chat-markdown.tsx        # Markdown renderer with actions
│   └── types.ts                 # Shared types
├── dashboard-penjual/     # Seller dashboard (protected)
│   ├── Card.tsx                 # Base card component
│   ├── SellerShell.tsx          # Layout shell with sidebar
│   ├── SalesStatsCard.tsx       # Revenue/orders chart
│   ├── StoreCard.tsx            # Store info card
│   ├── StoreRatingCard.tsx      # Rating display
│   ├── StoreVisitorCard.tsx     # Visitor analytics
│   ├── DetailedReportCard.tsx   # Period reports
│   └── ...
├── detail-product/        # Shell-injected product detail
│   ├── detail-page.tsx          # Layout orchestrator
│   └── DetailProductContent.tsx # Pure presentational
├── landing/               # Landing page sections (public)
│   ├── landing-shell.tsx        # MotionConfig + Lenis wrapper
│   ├── landing-navbar.tsx       # Fixed navbar with scroll spy
│   ├── hero-section.tsx
│   ├── trust-section.tsx
│   ├── how-it-works-section.tsx
│   ├── food-discovery-section.tsx
│   ├── seller-section.tsx
│   ├── buyer-section.tsx
│   features-section.tsx
│   benefits-section.tsx
│   faq-section.tsx
│   final-cta-section.tsx
│   landing-footer.tsx
│   scroll-to-section.ts         # Lenis scroll utility
│   team-lanyard-rail.tsx
│   └── ...
├── seller/                # Seller features (non-dashboard)
│   ├── subscription/
│   │   └── subscription-checkout-view.tsx
│   ├── tambahMenu/
│   │   └── EditProductModal.tsx
│   └── ...
├── shared/                # Truly shared (cross-actor)
│   ├── SmartImage.tsx           # Responsive image with AVIF fallback
│   ├── LocationPickerMap.tsx    # MapLibre map picker
│   ├── reveal.tsx               # Framer Motion scroll reveal
│   ├── skeletons/
│   │   ├── product-card-skeleton.tsx
│   │   └── ...
│   └── ...
└── ui/                    # shadcn/ui primitives (Radix-based)
    ├── button.tsx
    ├── dialog.tsx
    ├── badge.tsx
    ├── card.tsx
    ├── input.tsx
    ├── select.tsx
    ├── toast.tsx
    ├── avatar.tsx
    ├── dropdown-menu.tsx
    ├── popover.tsx
    ├── tooltip.tsx
    ├── table.tsx
    ├── tabs.tsx
    ├── checkbox.tsx
    ├── radio-group.tsx
    ├── slider.tsx
    ├── switch.tsx
    ├── progress.tsx
    ├── separator.tsx
    ├── scroll-area.tsx
    ├── label.tsx
    ├── form.tsx
    ├── textarea.tsx
    ├── accordion.tsx
    ├── alert.tsx
    ├── alert-dialog.tsx
    ├── aspect-ratio.tsx
    ├── breadcrumb.tsx
    ├── calendar.tsx
    ├── checkbox.tsx
    ├── collapsible.tsx
    ├── context-menu.tsx
    ├── hover-card.tsx
    ├── menubar.tsx
    ├── navigation-menu.tsx
    ├── pagination.tsx
    ├── popover.tsx
    ├── resizable.tsx
    ├── sheet.tsx
    ├── skeleton.tsx
    ├── sonner.tsx
    ├── switch.tsx
    ├── table.tsx
    ├── tabs.tsx
    ├── textarea.tsx
    ├── toggle.tsx
    ├── toggle-group.tsx
    └── ...
```

---

## Shell Injection Pattern

### The Problem

Product detail page needs different chrome based on context:
- Public preview → `LandingNavbar` (no auth)
- In-app → `MobileNavbar` + `ProfileNavbar` (auth)
- Store detail → `SellerShell` (seller auth)

### The Solution

**Presenter Component** (`app/components/detail-product/DetailProductContent.tsx`):
```tsx
// NO auth imports, NO navbar imports
// Purely presentational - receives shell as prop

interface DetailProductShell {
    header: ReactNode;
    productPath: string;        // e.g. "/detail/product"
    seeAllHref: string;         // e.g. "/makanan/makanan-berat"
}

export function DetailProductContent({ 
    shell, 
    product, 
    reviews, 
    isFollowing 
}: {
    shell: DetailProductShell;
    product: ProductView;
    reviews: Review[];
    isFollowing: boolean;
}) {
    // Render product detail using shell.header, shell.productPath, shell.seeAllHref
}
```

**Route Pages** supply the shell:

```tsx
// app/(app)/detail/product/page.tsx - In-app (buyer auth)
export default function DetailProductPage() {
    return (
        <DetailProductContent
            shell={{
                header: (
                    <>
                        <MobileNavbar />
                        <ProfileNavbar />
                    </>
                ),
                productPath: '/detail/product',
                seeAllHref: '/makanan/[category]',
            }}
        />
    );
}

// app/(landing)/preview/product/page.tsx - Public preview
export default function PreviewProductPage() {
    return (
        <DetailProductContent
            shell={{
                header: <LandingNavbar />,
                productPath: '/preview/product',
                seeAllHref: '/makanan/[category]',
            }}
        />
    );
}

// app/(app)/detail/toko/page.tsx - Store detail (seller context)
export default function DetailTokoPage() {
    return (
        <DetailProductContent
            shell={{
                header: <SellerShell />, // or custom seller header
                productPath: '/detail/toko',
                seeAllHref: '/toko',
            }}
        />
    );
}
```

**Benefits:**
1. **Bundle isolation**: `DetailProductContent` has zero auth imports → safe for public pages
2. **Single source of truth**: Product detail logic in one component
3. **Flexible chrome**: Each route decides its own navigation
4. **No pathname checks**: Eliminates `if (pathname.startsWith('/preview'))` conditionals

---

## Component Categories

### 1. Shell Components (Layout)

| Component | Purpose | Context |
|-----------|---------|---------|
| `LandingShell` | MotionConfig + Lenis + Preloader | `/` only |
| `BuyerShell` | MobileNavbar + ProfileNavbar | Buyer app pages |
| `SellerShell` | Sidebar + MobileNavbar | Seller dashboard |
| `AdminSidebar` | Admin navigation | Admin dashboard |
| `AuthSplitShell` | Split-screen auth layout | `/auth/*` pages |

### 2. Guard Components (Access Control)

| Component | Purpose | Usage |
|-----------|---------|-------|
| `RequireAuth` | Redirect to login if no session | Wraps entire page content |
| `RequireSeller` | Check umkm_profiles exists | Seller dashboard |
| `RequireAdmin` | Check admin role | Admin pages |

### 3. Data Display Components

| Component | Props | Data Source |
|-----------|-------|-------------|
| `ProductCard` | `product: ProductView` | `lib/catalog.ts` |
| `StoreCard` | `store: StoreView` | `hooks/seller/use-store-products` |
| `OrderCard` | `order: OrderView` | `hooks/buyer/use-buyer-orders` |
| `DeliveryMap` | `plan: DeliveryPlan` | `hooks/buyer/use-buyer-orders` |
| `SalesStatsCard` | `period: StatsPeriod` | `hooks/seller/use-seller-analytics` |

### 4. Form Components

| Component | Features |
|-----------|----------|
| `AuthForm` | Unified login/register, zod validation |
| `PenjualRegisterForm` | Multi-step: profile → store → verification |
| `EditProductModal` | Image upload, schedule, Flash Sale, weight |
| `SubscriptionCheckoutView` | Plan selection, billing cycle, Xendit redirect |

### 5. Interactive Components

| Component | Features |
|-----------|----------|
| `ChatbotWidget` | Fixed bottom-right, framer-motion panel, markdown, pending actions |
| `LocationPickerMap` | MapLibre GL, click to pick coordinates |
| `SmartImage` | AVIF/WebP/JPEG, blur placeholder, lazy load |
| `DeliveryMap` | Real-time courier position, route animation |
| `CourierChat` | Realtime chat with courier during delivery |

---

## SmartImage Component

**Critical for AVIF/JPEG path mismatch:**

```tsx
// app/components/shared/SmartImage.tsx
import { resolveImageSrc } from '@/lib/image-path';

interface SmartImageProps {
    src: string | null | undefined;
    alt: string;
    sizes?: string;
    className?: string;
    priority?: boolean;
}

export function SmartImage({ src, alt, sizes, className, priority }: SmartImageProps) {
    const resolvedSrc = useMemo(() => resolveImageSrc(src), [src]);
    
    if (!resolvedSrc) {
        return <div className={cn("bg-muted", className)} aria-hidden />;
    }
    
    // Check if external (Supabase Storage, Pexels)
    const isExternal = resolvedSrc.startsWith('http') || resolvedSrc.startsWith('data:');
    
    if (isExternal) {
        return <Image src={resolvedSrc} alt={alt} sizes={sizes} className={className} priority={priority} />;
    }
    
    // Local path: use next/image with public folder
    return (
        <Image
            src={resolvedSrc}
            alt={alt}
            sizes={sizes}
            className={className}
            priority={priority}
            // No loader needed for public folder
        />
    );
}
```

**Resolver** (`lib/image-path.ts`):
```typescript
export function resolveImageSrc(src: string | null | undefined): string | null {
    if (!src) return null;
    if (src.startsWith('http') || src.startsWith('data:')) return src;
    
    // Convert /makanan1.jpeg → /makanan1.avif
    // Convert /makanan9.webp → /makanan9.avif
    return src.replace(/\.(jpeg|jpg|webp)$/i, '.avif');
}
```

---

## Reveal Animation Pattern

```tsx
// app/components/shared/reveal.tsx
import { motion, useInView } from 'framer-motion';

export function Reveal({ 
    children, 
    delay = 0, 
    className,
    ...props 
}: { children: ReactNode; delay?: number; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const isInView = useInView(ref, { once: true, margin: '-50px' });
    
    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1], delay }}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
}
```

**Usage:**
```tsx
<Reveal delay={0.1}>
    <SalesStatsCard period={period} onPeriodChange={setPeriod} />
</Reveal>
```

---

## UI Primitives (shadcn/ui)

All components in `app/components/ui/` follow Radix UI patterns:

```tsx
// app/components/ui/button.tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default: 'bg-primary text-primary-foreground hover:bg-primary/90',
                destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
                secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                ghost: 'hover:bg-accent hover:text-accent-foreground',
                link: 'text-primary underline-offset-4 hover:underline',
            },
            size: {
                default: 'h-10 px-4 py-2',
                sm: 'h-9 rounded-md px-3',
                lg: 'h-11 rounded-md px-8',
                icon: 'h-10 w-10',
            },
        },
        defaultVariants: { variant: 'default', size: 'default' },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';
export { Button, buttonVariants };
```

**Usage:**
```tsx
<Button variant="default" size="lg" asChild>
    <Link href="/dashboard/penjual/tambahMenu">Tambah Menu</Link>
</Button>
```

---

## Component Import Conventions

### Path Aliases (tsconfig.json)
```json
{
    "compilerOptions": {
        "paths": {
            "@/*": ["./*"]
        }
    }
}
```

### Import Patterns

```tsx
// UI primitives
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';

// Shared components
import { SmartImage } from '@/app/components/shared/SmartImage';
import { Reveal } from '@/app/components/shared/reveal';

// Actor-specific
import { SellerShell } from '@/app/components/seller/dashboard-penjual/SellerShell';
import { RequireAuth } from '@/app/components/auth/require-auth';

// Hooks
import { useCurrentUser } from '@/lib/current-user';
import { useStoreProducts } from '@/hooks/seller/use-store-products';

// Lib utilities
import { cn } from '@/lib/utils';
import { formatRupiah } from '@/lib/data';
```

---

## Anti-Patterns to Avoid

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Importing navbar in shared component | Pass shell from route |
| `pathname` checks for chrome | Shell injection |
| Direct `supabase.auth.getSession()` in components | Use `useCurrentUser` hook |
| Inline styles instead of Tailwind | Use `cn()` with design tokens |
| Hardcoded colors (`bg-green-600`) | Use `bg-primary`, `bg-destructive` |
| `useEffect` for data fetching in Server Components | Use async Server Components + Suspense |
| Props drilling beyond 2 levels | Context or pass from route |

---

## Component Testing Strategy

| Component Type | Test Approach |
|----------------|---------------|
| UI primitives | Visual regression (manual) |
| Data display | Unit test with mock data |
| Forms | Integration test with react-hook-form |
| Guards | Unit test redirect behavior |
| Shell injection | Visual test with different shells |
| Chatbot | Unit test message flow, actions |

**Test Location**: `tests/` directory with `node --test` runner
- `tests/chatbot-markdown.test.ts`
- `tests/chatbot-panel-scroll.test.ts`
- `tests/ui-search-skeleton.test.ts`
- `tests/seller-rating-ui.test.ts`