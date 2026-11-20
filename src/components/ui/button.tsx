import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
/** All sizes keep a touch target of at least 48px. `lg` is the 56px main action; `xl` is a hero action. */
export type ButtonSize = "sm" | "md" | "lg" | "xl" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold leading-none transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-out select-none cursor-pointer active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-fg shadow-soft hover:bg-primary-hover hover:shadow-lift",
  secondary: "bg-surface text-fg border border-border-strong hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
  soft: "bg-primary-soft text-fg hover:bg-surface-3",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white dark:hover:text-bg",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-12 px-4 text-[0.9375rem]",
  md: "h-12 px-5 text-base",
  lg: "h-14 px-7 text-[1.0625rem]",
  xl: "h-16 px-8 text-lg",
  icon: "h-12 w-12",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string, fullWidth?: boolean) {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean }) {
  return <button type="button" className={buttonClass(variant, size, className, fullWidth)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "className"> & { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className, fullWidth)} {...props}>
      {children}
    </Link>
  );
}
