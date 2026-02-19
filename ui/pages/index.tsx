import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Safe Data Sharing Platform (V3)</h1>
      <p>
        This is a client-facing “cake”: scan risk → recommend anonymization → explain safety →
        generate safe clone → vendor-safe export → proof bundle.
      </p>
      <Link href="/wizard">Start Wizard →</Link>
    </main>
  );
}
