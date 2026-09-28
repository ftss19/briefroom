import { useEffect, useState } from "react";

type Note = {
  meeting_id: string;
  company: string;
  contact: string;
  meeting_date: string;
  objection: string;
  commitment: string;
  preference: string;
  outcome: string;
};
type Report = {
  provider: string;
  bank_id: string;
  evidence: { id: string; text: string }[];
  brief: string;
  trace: string[];
};
const storageKey = "briefroom-practice-memory-v1";
const samples = [
  {
    meeting_date: "2026-09-14",
    objection:
      "Anika will not approve a pilot until the security questionnaire is reviewed.",
    commitment:
      "Our team promised to send the security questionnaire before the next meeting. Completion is unconfirmed.",
    preference: "Anika prefers a three-bullet summary before any demo.",
    outcome: "Pilot decision postponed pending security review.",
  },
  {
    meeting_date: "2026-09-21",
    objection:
      "Security review is now approved. Anika says the remaining blocker is a ₹50,000 pilot budget cap.",
    commitment:
      "Our team promised to bring a revised pilot scope within ₹50,000; not yet confirmed delivered.",
    preference:
      "Keep the three-bullet summary and include a clear cost breakdown.",
    outcome:
      "Anika confirmed the security questionnaire was received and approved; discuss the smaller pilot next.",
  },
];
function initialNote(): Note {
  return {
    meeting_id: crypto.randomUUID(),
    company: "Northstar Labs",
    contact: "Anika Rao",
    ...samples[0],
  };
}
function readNotes(): Note[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
    const keys: (keyof Note)[] = [
      "meeting_id",
      "company",
      "contact",
      "meeting_date",
      "objection",
      "commitment",
      "preference",
      "outcome",
    ];
    return Array.isArray(value)
      ? value.filter(
          (n): n is Note =>
            n !== null &&
            typeof n === "object" &&
            keys.every((k) => typeof n[k] === "string"),
        )
      : [];
  } catch {
    return [];
  }
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : "Service unavailable or input invalid. Check the backend and retry.",
    );
  return data as T;
}
export default function MemoryStudio() {
  const [mode, setMode] = useState<"practice" | "hindsight">("practice");
  const [note, setNote] = useState<Note>(initialNote);
  const [notes, setNotes] = useState<Note[]>(readNotes);
  const [goal, setGoal] = useState(
    "Agree on the next pilot decision and confirm outstanding promises",
  );
  const [report, setReport] = useState<Report | null>(null);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/memory/status")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => setConfigured(d.configured))
      .catch(() => setConfigured(null));
  }, []);
  const history = notes
    .filter(
      (n) =>
        n.company.trim().toLowerCase() === note.company.trim().toLowerCase() &&
        n.contact.trim().toLowerCase() === note.contact.trim().toLowerCase(),
    )
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
  const latest = history[history.length - 1];
  function change<K extends keyof Note>(key: K, value: Note[K]) {
    setNote((n) => ({ ...n, [key]: value }));
    setReport(null);
    setMessage("");
  }
  async function retain() {
    setPending("Retaining meeting outcome…");
    setError("");
    setMessage("");
    setReport(null);
    try {
      if (mode === "hindsight") {
        await post("/api/memory/retain", note);
        setMessage(
          "Hindsight confirmed retention. Prepare the next meeting to recall it.",
        );
      } else {
        const updated = [
          ...notes.filter((n) => n.meeting_id !== note.meeting_id),
          note,
        ];
        localStorage.setItem(storageKey, JSON.stringify(updated));
        setNotes(updated);
        setMessage(
          "Saved in this browser only. This is offline practice, not Hindsight.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the note.");
    } finally {
      setPending("");
    }
  }
  async function prepare() {
    setPending("Recalling facts, then reflecting on the next meeting…");
    setError("");
    setMessage("");
    setReport(null);
    try {
      if (mode === "hindsight")
        setReport(
          await post<Report>("/api/memory/prepare", {
            company: note.company,
            contact: note.contact,
            goal,
          }),
        );
      else
        setReport({
          provider: "Offline practice — deterministic template, not AI",
          bank_id: "Browser storage only",
          evidence: history.map((n) => ({
            id: n.meeting_id,
            text: `${n.meeting_date}: ${n.objection} ${n.commitment} ${n.preference} ${n.outcome}`,
          })),
          brief: latest
            ? `Latest reported blocker (${latest.meeting_date})\n${latest.objection}\n\nPromise to verify\n${latest.commitment}\n\nAdapt the conversation\n${latest.preference}\n\nLatest reported outcome\n${latest.outcome}\n\nSuggested questions\n1. Is this still the main blocker?\n2. Has the promised follow-up been delivered?\n3. What decision can we make toward: ${goal}?\n\nConfirm these notes with the contact. This template selects the latest dated note; only live Hindsight performs semantic recall and reflection.`
            : "No meeting history yet. Save the first fictional meeting, then prepare again.",
          trace: [
            `Read ${history.length} saved practice notes`,
            latest
              ? "Applied latest dated note to a fixed template"
              : "No history: ask discovery questions",
          ],
        });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preparation failed.");
    } finally {
      setPending("");
    }
  }
  function exportMemory() {
    if (!report) return;
    const content = `BRIEFROOM — ${note.company} / ${note.contact}\nGoal: ${goal}\nProvider: ${report.provider}\n\n${report.brief}\n\nEVIDENCE\n${report.evidence.map((e) => `[${e.id}] ${e.text}`).join("\n\n")}`;
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/plain" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "briefroom-memory-brief.txt";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="memory-studio" aria-label="Persistent meeting memory">
      <div className="memory-banner">
        <div>
          <div className="eyebrow">THE MEETING AFTER THE MEETING</div>
          <h2>
            Remember the promise.
            <br />
            <span>Change the next conversation.</span>
          </h2>
          <p>
            For account teams who cannot afford to ask the same question twice.
          </p>
        </div>
        <div className="memory-mark">
          retain
          <br />
          <b>↓ recall</b>
          <br />↓ reflect
        </div>
      </div>
      <div className="memory-toolbar">
        <div className="switch">
          {(["practice", "hindsight"] as const).map((m) => (
            <button
              key={m}
              disabled={!!pending}
              className={mode === m ? "selected" : ""}
              onClick={() => {
                setMode(m);
                setReport(null);
                setError("");
                setMessage("");
              }}
            >
              {m === "practice" ? "Offline practice" : "Hindsight live"}
            </button>
          ))}
        </div>
        <span className="hint">
          {mode === "practice"
            ? "Fictional scenario · browser persistence · no AI calls"
            : configured
              ? "Server configured · connection verified when used"
              : configured === false
                ? "Hindsight setup required in server .env"
                : "Start the backend to check Hindsight configuration"}
        </span>
      </div>
      <div className="memory-grid">
        <form
          className="panel memory-form"
          onSubmit={(e) => {
            e.preventDefault();
            void retain();
          }}
        >
          <div className="section-label">01 / RETAIN WHAT HAPPENED</div>
          <h3>A meeting is more than notes.</h3>
          <fieldset disabled={!!pending}>
            <div className="field-pair">
              <label>
                Account
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={note.company}
                  onChange={(e) => change("company", e.target.value)}
                />
              </label>
              <label>
                Contact
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={note.contact}
                  onChange={(e) => change("contact", e.target.value)}
                />
              </label>
            </div>
            <div className="sample-buttons">
              {samples.map((sample, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => {
                    setNote((n) => ({
                      ...n,
                      ...sample,
                      meeting_id: crypto.randomUUID(),
                    }));
                    setReport(null);
                    setMessage("");
                  }}
                >
                  Load fictional meeting {i + 1}
                </button>
              ))}
            </div>
            <label>
              Meeting date
              <input
                type="date"
                required
                value={note.meeting_date}
                onChange={(e) => change("meeting_date", e.target.value)}
              />
            </label>
            <label>
              Objection / what changed
              <textarea
                required
                maxLength={2000}
                value={note.objection}
                onChange={(e) => change("objection", e.target.value)}
              />
            </label>
            <label>
              Promise & completion status
              <textarea
                required
                maxLength={2000}
                value={note.commitment}
                onChange={(e) => change("commitment", e.target.value)}
              />
            </label>
            <label>
              How this person likes to meet
              <input
                required
                maxLength={1000}
                value={note.preference}
                onChange={(e) => change("preference", e.target.value)}
              />
            </label>
            <label>
              Actual outcome
              <textarea
                required
                maxLength={2000}
                value={note.outcome}
                onChange={(e) => change("outcome", e.target.value)}
              />
            </label>
            <p className="hint">
              {mode === "hindsight"
                ? "Save sends these notes to your configured Hindsight instance. Use the fictional samples for judging."
                : "Practice notes stay in this browser across reloads. They are not encrypted; use fictional data."}
            </p>
            <button className="primary" type="submit">
              {pending ||
                (mode === "hindsight"
                  ? "Retain in Hindsight →"
                  : "Save practice meeting →")}
            </button>
          </fieldset>
        </form>
        <div className="memory-output">
          <section className="panel">
            <div className="section-label">02 / RECALL → REFLECT → PREPARE</div>
            <h3>Your next meeting starts here.</h3>
            <label>
              Next meeting goal
              <input
                minLength={5}
                maxLength={1000}
                disabled={!!pending}
                value={goal}
                onChange={(e) => {
                  setGoal(e.target.value);
                  setReport(null);
                }}
              />
            </label>
            <button
              className="primary"
              disabled={
                !!pending ||
                goal.trim().length < 5 ||
                note.company.trim().length < 2 ||
                note.contact.trim().length < 2
              }
              onClick={prepare}
            >
              {pending || "Prepare with memory ↗"}
            </button>
            <p role="status" className="hint">
              {message}
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="comparison">
              <div>
                <span className="section-label">
                  WITHOUT HISTORY · FIXED BASELINE
                </span>
                <p>“What are your priorities? What is blocking a pilot?”</p>
                <small>
                  No awareness of promises, resolved objections, or preferences.
                </small>
              </div>
              <div className={report ? "with-memory ready" : "with-memory"}>
                <span className="section-label">WITH HISTORY</span>
                <p>
                  {report
                    ? "The brief below uses the available history."
                    : "Retain a meeting, then prepare to reveal the difference."}
                </p>
              </div>
            </div>
            {report && (
              <div className="memory-report">
                <div className="report-label">{report.provider}</div>
                <pre>{report.brief}</pre>
                <button className="export" onClick={exportMemory}>
                  Export memory brief ↗
                </button>
                <details open>
                  <summary>
                    Evidence & operation trace ({report.evidence.length} facts)
                  </summary>
                  <ol>
                    {report.trace.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ol>
                  <p className="hint">Bank: {report.bank_id}</p>
                  {report.evidence.map((e) => (
                    <blockquote key={e.id}>
                      <p>{e.text}</p>
                      <small>Memory {e.id}</small>
                    </blockquote>
                  ))}
                </details>
              </div>
            )}
          </section>
          <section className="panel memory-timeline">
            <div className="section-label">03 / SHOW THE LEARNING LOOP</div>
            <h3>Two meetings. A different next step.</h3>
            <ol>
              <li>
                <strong>First call:</strong> security is blocking approval. Save
                the promise to follow up.
              </li>
              <li>
                <strong>Second call:</strong> security is approved; budget is
                the new blocker. Save the actual outcome.
              </li>
              <li>
                <strong>Prepare again:</strong> check whether the brief
                acknowledges the resolved concern, new budget, and preferred
                format.
              </li>
            </ol>
            <p className="hint">
              {mode === "practice"
                ? `${history.length} practice meeting(s) saved for this account/contact. Reload to verify persistence.`
                : "Hindsight performs recall and reflection on retained facts. Review evidence before acting; memory is not independent verification."}
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
