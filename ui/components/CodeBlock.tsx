export function CodeBlock({ text }: { text: string }) {
  return (
    <pre style={{
      background: "#0b0b0b",
      color: "#eaeaea",
      padding: 12,
      borderRadius: 8,
      overflowX: "auto"
    }}>{text}</pre>
  );
}
