export function Stepper({ step }: { step: number }) {
  const labels = [
    "Create Project",
    "Connect DB",
    "Scan Risk",
    "Recommend Plan",
    "Explain Safety",
    "Dryrun",
    "Apply + Export",
    "Proof",
  ];
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      {labels.map((l, i) => (
        <div key={l} style={{
          padding: "6px 10px",
          borderRadius: 999,
          border: "1px solid #ddd",
          background: i === step ? "#f5f5f5" : "transparent"
        }}>
          {i+1}. {l}
        </div>
      ))}
    </div>
  );
}
