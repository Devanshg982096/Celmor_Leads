import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface Props {
  breadcrumb?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export default function TopBar({ breadcrumb, actions }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] px-6">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        {breadcrumb?.map((item, i) => {
          const isLast = i === breadcrumb.length - 1;
          return (
            <div key={`${item.label}-${i}`} className="flex items-center gap-2 min-w-0">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="truncate text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
                <span aria-hidden className="text-[var(--text-tertiary)]">
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
