import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface Props {
  breadcrumb?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

/**
 * 52px sticky top bar with translucent backdrop blur. Breadcrumb on the left,
 * page-specific actions on the right. Per the redesign, the topbar is part of
 * the content area (not above the sidebar).
 */
export default function TopBar({ breadcrumb, actions }: Props) {
  return (
    <header className="topbar-glass sticky top-0 z-10 flex h-[52px] shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-6">
      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        {breadcrumb?.map((item, i) => {
          const isLast = i === breadcrumb.length - 1;
          return (
            <div
              key={`${item.label}-${i}`}
              className="flex items-center gap-2 min-w-0"
            >
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="truncate text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={
                    isLast
                      ? "truncate text-[var(--text-primary)] font-medium"
                      : "truncate text-[var(--text-secondary)]"
                  }
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <span aria-hidden className="text-[var(--text-quaternary)]">
                  /
                </span>
              )}
            </div>
          );
        })}
      </div>

      {actions && (
        <div className="flex items-center gap-3 shrink-0">{actions}</div>
      )}
    </header>
  );
}
