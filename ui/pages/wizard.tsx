import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { Stepper } from "../components/Stepper";
import { CodeBlock } from "../components/CodeBlock";
import JSZip from "jszip";


function downloadBlob(filename: string, blob: Blob) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

async function downloadFromApi(path: string, filename: string, opts?: RequestInit) {
  const API = process.env.NEXT_PUBLIC_PLATFORM_API || "http://localhost:5050";
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  downloadBlob(filename, blob);
}

async function uploadFile(path: string, file: File) {
  const API = process.env.NEXT_PUBLIC_PLATFORM_API || "http://localhost:5050";
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API}${path}`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function downloadZipFromJson(
  zipFiles: { name: string; content: string }[],
  filename: string
) {
  
  const zip = new JSZip();

  zipFiles.forEach((f) => {
    zip.file(f.name, f.content);
  });

  zip.generateAsync({ type: "blob" }).then((blob: Blob) => {
    downloadBlob(filename, blob);
  });
}



export default function Wizard() {
  const [step, setStep] = useState(0);
  const [projectId, setProjectId] = useState<string>("");
  const [conn, setConn] = useState(
    "postgresql://username:password@localhost:5432/database_name"
  );

  
  const [created, setCreated] = useState(false);
  const [connected, setConnected] = useState(false);

  // Files
  const [configFile, setConfigFile] = useState<File | null>(null);

  const [configGenerated, setConfigGenerated] = useState(false);
  const [configUploaded, setConfigUploaded] = useState(false);

  const [aiRecommendationYaml, setAiRecommendationYaml] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "llm" | "heuristic">("idle");
  const [applyStatus, setApplyStatus] = useState<"idle"|"loading"|"done">("idle");

  const [llmProgress, setLlmProgress] = useState(0);
  const [llmTimer, setLlmTimer] = useState<any>(null);
  
  const [explanationDone, setExplanationDone] = useState(false);
  const [dryrunDone, setDryrunDone] = useState(false);
  const [explainStatus, setExplainStatus] = useState<"idle"|"loading"|"done">("idle");
  const [explainProgress, setExplainProgress] = useState(0);



  // apply settings
  const [cloneDbName, setCloneDbName] = useState("tabb_dev_anonymized");

  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const canCreate = true;
  const canConnect = created && !!projectId && conn.length > 10;
  const canGenerate = connected;
  const canUploadConfig = configGenerated;
  const canExplain = configUploaded;
  const canDryrun = explanationDone;
  const canApply = dryrunDone;




function startProgressSimulation() {
  setLlmProgress(5);

  const interval = setInterval(() => {
    setLlmProgress((prev) => {
      if (prev >= 90) return prev;
      return prev + Math.random() * 5;
    });
  }, 800);

  setLlmTimer(interval);
}

function completeProgressSimulation() {
  if (llmTimer) clearInterval(llmTimer);
  setLlmProgress(100);

  setTimeout(() => {
    setLlmProgress(0);
  }, 800);
}

let explainInterval: any;

function startExplainProgress() {
  setExplainProgress(5);

  explainInterval = setInterval(() => {
    setExplainProgress((prev) => {
      if (prev >= 90) return prev;
      return prev + Math.random() * 6;
    });
  }, 700);
}

function completeExplainProgress() {
  if (explainInterval) clearInterval(explainInterval);

  setExplainProgress(100);

  setTimeout(() => {
    setExplainProgress(0);
    setExplainStatus("done");
  }, 600);
}



  async function run(fn: () => Promise<void>) {
    setErr("");
    setInfo("");
    try {
      await fn();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  const primaryButtonStyle: React.CSSProperties = {
  background: "linear-gradient(135deg,#2563eb,#1e40af)",
  color: "white",
  border: "none",
  padding: "10px 18px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  transition: "all 0.2s ease",
  boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
};

const disabledButtonStyle: React.CSSProperties = {
  background: "#e5e7eb",
  color: "#9ca3af",
  border: "none",
  padding: "10px 18px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 14,
  cursor: "not-allowed",
};


  return (
    <main
        style={{
          maxWidth: 1100,
          margin: "40px auto",
          fontFamily: "Inter, system-ui, sans-serif",
          background: "linear-gradient(180deg,#f8fafc,#eef2ff)",
          padding: 30,
          borderRadius: 20,
          boxShadow: "0 10px 40px rgba(0,0,0,0.05)",
        }}
      >
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 10 }}>
        Database Anonymizer
      </h1>
      <hr style={{ margin: "20px 0", opacity: 0.1 }} />

      <Stepper step={step} />

      {err && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#7f1d1d",
            color: "white",
            padding: "16px 20px",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            maxWidth: 420,
            zIndex: 1000,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            ⚠ Operation Failed
          </div>
          <div style={{ fontSize: 13 }}>{err}</div>
          <div
            style={{ marginTop: 10, cursor: "pointer", fontSize: 12, opacity: 0.8 }}
            onClick={() => setErr("")}
          >
            Dismiss
          </div>
        </div>
      )}


      {info && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: 24,
            background: "#065f46",
            color: "white",
            padding: "14px 18px",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            maxWidth: 400,
            zIndex: 1000,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            ✅ Success
          </div>
          <div style={{ fontSize: 13 }}>{info}</div>
          <div
            style={{ marginTop: 8, cursor: "pointer", fontSize: 12 }}
            onClick={() => setInfo("")}
          >
            Dismiss
          </div>
        </div>
      )}



      {/* 1) Create Project */}
      <section
        style={{
          marginBottom: 24,
          padding: 22,
          borderRadius: 16,
          background: "white",
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 18px rgba(0,0,0,0.04)",
          transition: "all 0.2s ease",
        }}
      >

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>1) Create Project</h2>
        <button
          style={canCreate ? primaryButtonStyle : disabledButtonStyle}
          disabled={!canCreate}
          onClick={() =>
            run(async () => {
              const p = await api<any>("/projects", { method: "POST" });
              setProjectId(p.id);
              setCreated(true);
              setStep(1);
              setInfo(`Project created: ${p.id}`);
            })
          }
        >
          Create
        </button>
        {projectId && <p>Project ID: <b>{projectId}</b></p>}
      </section>

      {/* 2) Connect DB */}
      <section
        style={{
          marginBottom: 24,
          padding: 22,
          borderRadius: 16,
          background: "white",
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 18px rgba(0,0,0,0.04)",
          transition: "all 0.2s ease",
        }}
      >

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>2) Connect Database (read-only credentials)</h2>
        <p>
          Paste a Postgres connection string. Use read-only credentials in real customer setups.
        </p>

        <input
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            fontSize: 14,
          }}

          placeholder="postgresql://username:password@localhost:5432/database_name"
          value={conn}
          onChange={(e) => setConn(e.target.value)}
        />

        <div style={{ marginTop: 10 }}>
          <button
            style={canConnect ? primaryButtonStyle : disabledButtonStyle}
            disabled={!canConnect}
            onClick={() =>
              run(async () => {
                await api(`/projects/${projectId}/connect`, {
                  method: "POST",
                  body: JSON.stringify({ connectionString: conn }),
                });
                setConnected(true);
                setStep(2);
                setInfo("Connected. Ready to generate config + samples.");
              })
            }
          >
            Connect to Database
          </button>
        </div>
      </section>

      {/* 3) ConfigGen -> download files */}
      <section
        style={{
          marginBottom: 24,
          padding: 22,
          borderRadius: 16,
          background: "white",
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 18px rgba(0,0,0,0.04)",
          transition: "all 0.2s ease",
        }}
      >

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>3) Generate Config + Samples (download)</h2>
        <p>
          This behaves like CLI <code>--configGen</code>: it generates{" "}
          <code>anonymizer.config.yaml</code> and <code>anonymizer.samples.yaml</code>.
        </p>


        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>

          {/* BUTTON 1 — Generate Config */}
          <button
            style={canGenerate ? primaryButtonStyle : disabledButtonStyle}
            disabled={!canGenerate}
            onClick={() =>
              run(async () => {
                const API = process.env.NEXT_PUBLIC_PLATFORM_API || "http://localhost:5050";

                const res = await fetch(`${API}/projects/${projectId}/configGen`, {
                  method: "POST",
                });

                if (!res.ok) throw new Error(await res.text());

                const json = await res.json();

                downloadZipFromJson(
                  json.download.zip,
                  `anonymizer-configGen-${projectId}.zip`
                );

                setConfigGenerated(true);
                setInfo("Default config & samples downloaded. You may edit this and upload now or You can run AI recommendation, wait till it gets over, use that as reference and then edit the config and upload it.");
              })
            }
          >
            Download Default Config
          </button>

          {/* BUTTON 2 — Run AI Recommendation */}
          <button
            style={configGenerated ? primaryButtonStyle : disabledButtonStyle}
            disabled={!configGenerated || aiStatus === "loading"}
            onClick={() =>
              run(async () => {
                setAiStatus("loading");
                startProgressSimulation();

                const API =
                  process.env.NEXT_PUBLIC_PLATFORM_API || "http://localhost:5050";

                const res = await fetch(`${API}/projects/${projectId}/recommend`, {
                  method: "POST",
                });

                if (!res.ok) {
                  completeProgressSimulation();
                  throw new Error(await res.text());
                }

                const json = await res.json();

                setAiRecommendationYaml(json.recommended_column_strategy);
                setAiStatus(json.source === "llm" ? "llm" : "heuristic");

                completeProgressSimulation();
              })
            }
          >
            Run AI Recommendation
          </button>
          <p style={{ fontSize: 13, marginTop: 8, opacity: 0.7 }}>
            AI analysis reviews column semantics and recommends strategies.
            This may take few minutes depending on schema size.
            </p>


        </div>


        {aiStatus === "loading" && (
          <div style={{ marginTop: 12 }}>
            <div style={{
              height: 8,
              background: "#e5e7eb",
              borderRadius: 6,
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${llmProgress}%`,
                background: "linear-gradient(90deg,#3b82f6,#06b6d4)",
                transition: "width 0.5s ease",
              }} />
            </div>

            <div style={{ marginTop: 8, fontSize: 13 }}>
              ⏳ Running AI analysis… this may take few minutes.
            </div>
          </div>
        )}


        {aiStatus === "llm" && (
          <div
            style={{
              marginTop: 12,
              background: "#dcfce7",
              color: "#166534",
              padding: "10px 14px",
              borderRadius: 10,
              fontWeight: 600,
              display: "inline-block",
            }}
          >
            ✅ AI recommendations generated using LLM
          </div>
        )}


        {aiStatus === "heuristic" && (
          <div
            style={{
              marginTop: 12,
              background: "#fef3c7",
              color: "#92400e",
              padding: "10px 14px",
              borderRadius: 10,
              fontWeight: 600,
              display: "inline-block",
            }}
          >
            ⚠️ AI unavailable — heuristic fallback used
          </div>
        )}



        {aiRecommendationYaml && (
          <>
            <h3 style={{ marginTop: 16 }}>
              Suggested <code>column_strategy</code>{" "}
              {aiStatus === "llm" ? "(AI-generated)" : "(heuristic fallback)"}
            </h3>


            <div style={{
                background: "#0f172a",
                borderRadius: 12,
                padding: 16,
                fontSize: 13,
              }}
              >
              <CodeBlock text={aiRecommendationYaml} />
            </div>


            <p style={{ fontSize: 13, opacity: 0.8 }}>
              These are suggestions only. Nothing is auto-applied.
              Edit <code>anonymizer.config.yaml</code> as needed before uploading.
            </p>
          </>
        )}


      </section>

      {/* 4) Upload config (edited) */}
      <section
        style={{
          marginBottom: 24,
          padding: 22,
          borderRadius: 16,
          background: "white",
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 18px rgba(0,0,0,0.04)",
          transition: "all 0.2s ease",
        }}
      >

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>4) Upload Edited Config (required before dryrun/apply)</h2>
        <p>
          Upload your edited <code>anonymizer.config.yaml</code>. (This matches CLI behaviour: you edit then run dryrun/apply.)
        </p>

        <input
          disabled={!canUploadConfig}
          type="file"
          accept=".yaml,.yml"
          onChange={(e) => setConfigFile(e.target.files?.[0] || null)}
        />

        <div style={{ marginTop: 10 }}>
          <button
            style={canUploadConfig ? primaryButtonStyle : disabledButtonStyle}
            disabled={!canUploadConfig || !configFile}
            onClick={() =>
              run(async () => {
                await uploadFile(`/projects/${projectId}/upload/config`, configFile!);
                setConfigUploaded(true);
                setStep(4);
                setInfo("Config uploaded. You can now run dryrun.");
              })
            }
          >
            Upload Config
          </button>
        </div>
      </section>

      {/* 5) AI explain -> download proof.md */}
      <section
        style={{
          marginBottom: 24,
          padding: 22,
          borderRadius: 16,
          background: "white",
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 18px rgba(0,0,0,0.04)",
          transition: "all 0.2s ease",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
          5) Explain My Data Safety (download)
        </h2>

        <p>
          Generates a client-friendly explanation (proof.md). Uses LLM if configured; otherwise falls back to heuristics.
        </p>

        <button
          style={configUploaded && explainStatus !== "loading" ? primaryButtonStyle : disabledButtonStyle}
          disabled={!configUploaded || explainStatus === "loading"}
          onClick={() =>
            run(async () => {
              setExplainStatus("loading");
              startExplainProgress();

              await downloadFromApi(
                `/projects/${projectId}/explain`,
                `proof-${projectId}.md`,
                { method: "POST" }
              );

              completeExplainProgress();
              setExplanationDone(true);
              setStep(5);
              setInfo("Downloaded proof.md.");
            })
          }
        >
          {explainStatus === "loading" ? "Generating…" : "Generate Explanation (Download)"}
        </button>

        {explainStatus === "loading" && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                height: 8,
                background: "#e5e7eb",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${explainProgress}%`,
                  background: "linear-gradient(90deg,#6366f1,#3b82f6)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>

            <div style={{ marginTop: 8, fontSize: 13 }}>
              ⏳ Generating safety explanation… this may take some time.
            </div>
          </div>
        )}

        {explainStatus === "done" && (
          <div
            style={{
              marginTop: 12,
              background: "#dcfce7",
              color: "#166534",
              padding: "10px 14px",
              borderRadius: 10,
              fontWeight: 600,
              display: "inline-block",
            }}
          >
            ✅ Safety explanation generated successfully
          </div>
        )}
      </section>


      {/* 6) Dryrun -> download dryrun report */}
      <section
        style={{
          marginBottom: 24,
          padding: 22,
          borderRadius: 16,
          background: "white",
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 18px rgba(0,0,0,0.04)",
          transition: "all 0.2s ease",
        }}
      >

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>6) Dryrun (download report)</h2>
        <p>
          Runs updates inside a transaction and rolls back. You get a dryrun JSON report like CLI.
        </p>

        <button
          style={configUploaded ? primaryButtonStyle : disabledButtonStyle}
          disabled={!configUploaded}
          onClick={() =>
            run(async () => {
              await downloadFromApi(
                `/projects/${projectId}/dryrun`,
                `anonymize.dryrun.report.${projectId}.json`,
                { method: "POST" }
              );
              setDryrunDone(true);
              setStep(6);
              setInfo("Downloaded dryrun report.");
            })
          }
        >
          Run Dryrun (Download Report)
        </button>
      </section>

      {/* 7) Apply -> download zip (apply report + export + proof) */}
      <section
        style={{
          marginBottom: 24,
          padding: 22,
          borderRadius: 16,
          background: "white",
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 18px rgba(0,0,0,0.04)",
          transition: "all 0.2s ease",
        }}
      >

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>7) Apply + Clone + Vendor Export + Proof (download bundle)</h2>
        <p>
          Clones DB, applies anonymization on the clone, exports vendor-safe SQL, and bundles proof + reports.
        </p>

        <input
          style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #d1d5db",
          fontSize: 14,
        }}

          value={cloneDbName}
          onChange={(e) => setCloneDbName(e.target.value)}
          disabled={!canApply}
        />

        <div style={{ marginTop: 10 }}>
          <button
            style={canApply ? primaryButtonStyle : disabledButtonStyle}
            disabled={!canApply}
            onClick={() =>
              run(async () => {
                setApplyStatus("loading");
                startProgressSimulation();

                await downloadFromApi(
                  `/projects/${projectId}/apply`,
                  `proof-bundle-${projectId}.zip`,
                  {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ cloneDbName }),
                  }
                );

                completeProgressSimulation();
                setApplyStatus("done");

                setStep(7);
                setInfo("Downloaded proof bundle ZIP.");
              })
            }
          >
            Run Apply (Download Bundle)
          </button>
        </div>
      </section>
    </main>
  );
}

