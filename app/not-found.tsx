import Link from "next/link";

/**
 * Root 404 — reached only for paths outside any locale (e.g. /nonsense before
 * the middleware rewrites). It has no locale, so it renders its own <html> and
 * stays in English.
 */
export default function RootNotFound() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          backgroundColor: "#F5F5F7",
          color: "#14213D",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: "3.5rem",
              fontWeight: 700,
              color: "#AD4428",
            }}
          >
            404
          </p>
          <h1 style={{ margin: "1rem 0 0", color: "#14213D" }}>
            This page doesn&apos;t exist.
          </h1>
          <p style={{ color: "rgba(20,33,61,0.75)" }}>
            The link may be old, or the page may not be built yet.
          </p>
          <Link
            href="/en"
            style={{
              display: "inline-block",
              marginTop: "1.5rem",
              padding: "0.875rem 1.75rem",
              borderRadius: "999px",
              backgroundColor: "#E07A5F",
              color: "#14213D",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Back to home
          </Link>
        </div>
      </body>
    </html>
  );
}
