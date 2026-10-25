import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, LoaderCircle } from "lucide-react";
import { supabaseSetupError } from "../lib/supabase";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
  to?: string;
};

const buttonStyles = {
  primary: "button button-primary",
  secondary: "button button-secondary",
  quiet: "button button-quiet",
};

export function Button({ variant = "primary", to, className = "", children, ...props }: ButtonProps) {
  const classes = `${buttonStyles[variant]} ${className}`.trim();
  return to ? (
    <Link className={classes} to={to}>
      {children}
    </Link>
  ) : (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title-row">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({
  children,
  tone = "info",
}: PropsWithChildren<{ tone?: "info" | "error" | "success" }>) {
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <AlertCircle aria-hidden="true" size={18} />
      <div>{children}</div>
    </div>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="state-card" role="status">
      <LoaderCircle className="spin" aria-hidden="true" size={22} />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="state-card empty-state">
      <span className="empty-icon" aria-hidden="true">✳</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <Link className="text-link" to={action.to}>
          {action.label} <ArrowRight size={15} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export function ConfigNotice() {
  return (
    <Notice>
      <strong>Supabase setup required.</strong> {supabaseSetupError} Then apply the included
      migration and deploy the Edge Functions. Use only the public anon/publishable key in Vite;
      never put a service-role or secret key in the frontend.
    </Notice>
  );
}
