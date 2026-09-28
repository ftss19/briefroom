import { useState } from "react";
import MemoryStudio from "./MemoryStudio";

type Source = { title: string; url: string; content: string };
const demoSources: Source[] = [
  {
    title: "A shared starting point",
    url: "https://www.northstarlabs.example",
    content:
      "Fictional demo: Northstar Labs is evaluating a research assistant for its customer success team. The team currently spends 40 minutes preparing for each account review.",
  },
  {
    title: "The decision behind the meeting",
    url: "https://www.northstarlabs.example/pilot",
    content:
      "Fictional demo: The buyer wants a two-week pilot. Their key concerns are evidence quality, adoption, and how to measure time saved.",
  },
];
export default function App() {
  const [company, setCompany] = useState("Northstar Labs");
  const [goal, setGoal] = useState(
    "Agree on a two-week research assistant pilot",
  );
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [sources, setSources] = useState<Source[]>(demoSources);
  const [brief, setBrief] = useState({
    company: "Northstar Labs",
    goal: "Agree on a two-week research assistant pilot",
    demo: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Brief");
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState(0);
  const [checked, setChecked] = useState<string[]>([]);
  const questions = [
    `Why should ${brief.company} prioritize this now?`,
    "What evidence would convince us this worked?",
    "What could derail the pilot, and how will we address it?",
  ];
  async function generate() {
    setBusy(true);
    setError("");
    try {
      let next = demoSources;
      if (mode === "live") {
        const response = await fetch("/api/brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company, goal }),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            typeof data.detail === "string"
              ? data.detail
              : "Check your company and goal, then retry.",
          );
        next = data.sources;
      }
      setSources(next);
      setBrief({
        company: mode === "demo" ? "Northstar Labs" : company,
        goal:
          mode === "demo"
            ? "Agree on a two-week research assistant pilot"
            : goal,
        demo: mode === "demo",
      });
      setChecked([]);
      setQuestion(0);
      setAnswer("");
      setTab("Brief");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate brief.");
    } finally {
      setBusy(false);
    }
  }
  function download() {
    const text =
      `# ${brief.company} — meeting brief\n\n${brief.demo ? "FICTIONAL DEMO" : "Live web research"}\n\nGoal: ${brief.goal}\n\n` +
      sources.map((s) => `${s.title}\n${s.content}\n${s.url}`).join("\n\n") +
      "\n\nDiscussion prompts\n" +
      questions.join("\n") +
      "\n\nRehearsal notes\n" +
      answer;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "briefroom-brief.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="#">
          ◈{" "}
          <span>
            briefroom<span className="dot">.</span>
          </span>
        </a>
        <div className="workspace">YOUR WORKSPACE</div>
        <div className="nav active">▦ &nbsp; Meeting studio</div>
        <div className="aside-note">
          <span className="spark">✳</span>
          <h3>
            A little context.
            <br />A better conversation.
          </h3>
          <p>Research, rehearse, and walk in ready.</p>
        </div>
        <small>
          Built on Tavily’s meeting-prep agent
          <br />
          Meeting memory / 02
        </small>
      </aside>
      <main>
        <header>
          <span>
            WORKSPACE <b>/ Meeting studio</b>
          </span>
          <span className="badge">
            ● {brief.demo ? "Demo workspace" : "Live research"}
          </span>
        </header>
        <section className="heading">
          <div className="eyebrow">MAKE THE NEXT CONVERSATION COUNT</div>
          <h1>
            Walk in with
            <br />
            <em>an unfair advantage.</em>
          </h1>
          <p>
            Your meeting context, a clear game plan, and the questions worth
            asking.
          </p>
        </section>
        <MemoryStudio />
        <details className="research-drawer">
          <summary>
            Optional: public research, rehearsal & readiness tools
          </summary>
          <div className="studio">
            <section className="setup panel">
              <div className="section-label">01 / SET THE INTENTION</div>
              <h2>Who’s in the room?</h2>
              <div className="switch">
                {(["demo", "live"] as const).map((m) => (
                  <button
                    key={m}
                    className={mode === m ? "selected" : ""}
                    onClick={() => setMode(m)}
                  >
                    {m === "demo" ? "Try the demo" : "Live research"}
                  </button>
                ))}
              </div>
              <label>
                Company
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  maxLength={160}
                  disabled={mode === "demo"}
                />
              </label>
              <label>
                Your ideal outcome
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  maxLength={1000}
                  disabled={mode === "demo"}
                />
              </label>
              <p className="hint">
                {mode === "demo"
                  ? "Explore a fictional meeting. No API keys required."
                  : "Live mode searches public sources with Tavily. Keep confidential details out of your search goal."}
              </p>
              <button
                className="primary"
                disabled={
                  busy || company.trim().length < 2 || goal.trim().length < 5
                }
                onClick={generate}
              >
                {busy ? "Researching…" : "Build my brief"} <span>↗</span>
              </button>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <div className="powered">
                RESEARCH ENGINE <strong>tavily</strong>
              </div>
            </section>
            <section className="result panel" aria-busy={busy}>
              <div className="result-top">
                <span className="section-label">
                  02 / YOUR MEETING PLAYBOOK
                </span>
                <button className="export" onClick={download}>
                  Export ↗
                </button>
              </div>
              <h2>{brief.company}</h2>
              <p className="outcome">{brief.goal}</p>
              <div className="tabs">
                {["Brief", "Rehearse", "Checklist"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    aria-pressed={tab === t}
                    className={tab === t ? "current" : ""}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {tab === "Brief" && (
                <>
                  <div className="callout">
                    <span>✳</span>
                    <div>
                      <strong>
                        {brief.demo
                          ? "Fictional sample, real workflow"
                          : "Evidence before assumptions"}
                      </strong>
                      <p>
                        {brief.demo
                          ? "Use this sample to explore your preparation flow. Switch to live for real company research."
                          : "These are source excerpts, not verified conclusions. Open the sources and validate before your meeting."}
                      </p>
                    </div>
                  </div>
                  <div className="section-label">
                    SIGNALS TO BRING INTO THE ROOM
                  </div>
                  {sources.length === 0 && (
                    <p>No sources found. Try a more specific company name.</p>
                  )}
                  {sources.map((s, i) => (
                    <article key={i}>
                      <span className="number">0{i + 1}</span>
                      <div>
                        <h3>{s.title}</h3>
                        <p>{s.content}</p>
                        {!brief.demo && (
                          <a href={s.url} target="_blank" rel="noreferrer">
                            Read source ↗
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                  <div className="next">
                    <div className="section-label">
                      SUGGESTED OPENING QUESTION
                    </div>
                    <h3>“What would make this meeting a win for you?”</h3>
                  </div>
                </>
              )}
              {tab === "Rehearse" && (
                <div className="rehearse">
                  <span className="section-label">
                    QUESTION {question + 1} OF {questions.length} · PRACTICE
                    PROMPT
                  </span>
                  <h3>{questions[question]}</h3>
                  <label>
                    Your talking points
                    <textarea
                      placeholder="Practice a concise answer. Start with the outcome, then your evidence."
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                    />
                  </label>
                  <p className="hint">
                    Self-check: did you name an outcome, support it with
                    evidence, and invite their perspective? These are practice
                    prompts, not AI-scored feedback.
                  </p>
                  <button
                    className="primary"
                    onClick={() => {
                      setQuestion((question + 1) % questions.length);
                    }}
                  >
                    Next question →
                  </button>
                </div>
              )}
              {tab === "Checklist" && (
                <div className="checklist">
                  <h3>{checked.length} / 4 ready-to-meet essentials</h3>
                  {[
                    "Validate the source material",
                    "Define one measurable outcome",
                    "Prepare a question for the decision-maker",
                    "Agree on an owner and a next step",
                  ].map((item) => (
                    <label key={item}>
                      <input
                        type="checkbox"
                        checked={checked.includes(item)}
                        onChange={() =>
                          setChecked((c) =>
                            c.includes(item)
                              ? c.filter((x) => x !== item)
                              : [...c, item],
                          )
                        }
                      />
                      {item}
                    </label>
                  ))}
                </div>
              )}
            </section>
          </div>
        </details>
        <footer>
          Less scrambling. More substance.
          <span>BRIEFROOM / POWERED BY CURIOSITY</span>
        </footer>
      </main>
    </div>
  );
}
