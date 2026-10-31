import Link from "next/link";
import { Activity, ArrowLeft, Home, Search } from "lucide-react";
import { NexoraIcon } from "@/components/ui/NexoraLogo";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#07090e",
        color: "#f8fafc",
        padding: "24px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "480px",
          height: "480px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 10, maxWidth: "540px" }}>
        {/* Brand Icon */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "15px",
            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.98))",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "24px",
            boxShadow: "0 0 24px rgba(99, 102, 241, 0.45)",
          }}
        >
          <NexoraIcon size={40} withGlow={true} />
        </div>

        {/* 404 Code with Gradient */}
        <div
          style={{
            fontSize: "clamp(64px, 10vw, 110px)",
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            background: "linear-gradient(135deg, #f8fafc 40%, #818cf8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: "12px",
            fontFamily: "var(--font-mono)",
          }}
        >
          404
        </div>

        <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "12px", color: "var(--text-primary)" }}>
          Page or Telemetry Stream Not Found
        </h1>

        <p style={{ color: "var(--text-secondary)", fontSize: "15px", lineHeight: 1.6, marginBottom: "32px" }}>
          The URL you requested doesn&apos;t exist or has been relocated to another workspace node. Check your route or return to the main dashboard.
        </p>

        <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/"
            className="btn btn-primary"
            style={{ padding: "12px 24px", fontSize: "14px", display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <Home size={16} /> Return to Homepage
          </Link>
          <Link
            href="/dashboard"
            className="btn btn-secondary"
            style={{ padding: "12px 24px", fontSize: "14px", display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <Activity size={16} /> Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
