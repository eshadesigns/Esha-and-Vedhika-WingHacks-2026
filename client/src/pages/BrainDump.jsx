import { useNavigate } from "react-router-dom"
import { useState } from "react"

function clusterOf(text) {
  const t = text.toLowerCase()

  if (/(resume|linkedin|apply|interview|portfolio)/.test(t)) return "career"
  if (/(homework|exam|quiz|study|class)/.test(t)) return "school"
  if (/(hackathon|build|app|startup|business)/.test(t)) return "build"

  return "other"
}

function BrainDump() {
  const navigate = useNavigate()
  const [ideas, setIdeas] = useState([])
  const [text, setText] = useState("")

  function addIdea() {
    if (!text.trim()) return

    const newIdea = {
    id: Date.now(),
    text: text,
    cluster: clusterOf(text),
    done: false
    }

    setIdeas(prev => [...prev, newIdea])
    setText("")
  }

  function goToSynthesize() {
    navigate("/synthesize", {
      state: { ideas }
    })
  }

  return (
  <div
  // Background with radial gradients and dark base color, and also make it take the full height of the viewport
    style={{
      minHeight: "100vh",
      background:
        "radial-gradient(900px 900px at 25% 20%, rgba(106, 206, 119, 0.28), transparent 50%)," +
        "radial-gradient(900px 900px at 20% 70%, rgba(149, 61, 126, 0.2), transparent 55%)," +
        "radial-gradient(800px 450px at 90% 30%, rgba(0,198,255,0.20), transparent 55%)," +
        "#0f0620",
      color: "white",
      position: "relative",
      overflow: "hidden",
    }}
  >
    {/* Top title */}
    <div style={{ padding: 24, paddingBottom: 0 }}>
      <div style={{ fontSize: 28, fontWeight: 800 }}>IdeaNet</div>
      <div style={{ opacity: 0.75, marginTop: 6 }}>
        Dump everything on your mind
      </div>
    </div>

    {/* Bubble canvas area */}
    <div
        style={{
            position: "relative",
            height: "calc(100vh - 170px)",
        }}
        >
        {/* Connection Lines */}
        <svg
            width="100%"
            height="100%"
            style={{
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 0
            }}
        >
            {ideas.map((idea, i) =>
            ideas.map((other, j) => {
                if (i >= j) return null
                //if the two ideas belong to the same cluster, draw a line between them
                if (idea.cluster === other.cluster) {
                return (
                    <line
                    key={`${idea.id}-${other.id}`}
                    x1={`${(i * 97) % 80 + 8}%`}
                    y1={`${(i * 53) % 70 + 10}%`}
                    x2={`${(j * 97) % 80 + 8}%`}
                    y2={`${(j * 53) % 70 + 10}%`}
                    stroke="rgba(148, 147, 147, 0.93)"
                    strokeWidth="1.5"
                    />
                )
                }

                return null
            })
            )}
        </svg>

        {/* BUBBLES */}
        {ideas.map((idea, idx) => (
            <div
            key={idea.id}
            style={{
                position: "absolute",
                left: `${(idx * 97) % 80 + 8}%`,
                top: `${(idx * 53) % 70 + 10}%`,
                transform: "translate(-50%, -50%)",
                padding: "10px 14px",
                borderRadius: 999,
                background: "rgba(150,120,255,0.16)",
                border: "1px solid rgba(255,255,255,0.18)",
                zIndex: 1,
                boxShadow:
                "0 0 18px rgba(103,77,255,0.45), 0 0 40px rgba(0,198,255,0.18)"
            }}
            >
            {idea.text}
            </div>
        ))}
        </div>

    {/* Bottom input bar*/}
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        padding: 18,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none", // allows clicks only on inner bar
      }}
    >
      <div
        style={{
          width: "min(900px, 94vw)",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.16)",
          borderRadius: 999,
          padding: 10,
          display: "flex",
          gap: 10,
          alignItems: "center",
          backdropFilter: "blur(12px)",
          boxShadow: "0 10px 35px rgba(0,0,0,0.35)",
          pointerEvents: "auto",
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type an idea…"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "white",
            fontSize: 15,
            padding: "10px 12px",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") addIdea();
          }}
        />

        <button
          onClick={addIdea}
          disabled={!text.trim()}
          style={pillBtn(false, !text.trim())}
        >
          Add
        </button>

        <button
          onClick={goToSynthesize}
          disabled={ideas.length === 0}
          style={pillBtn(true, ideas.length === 0)}
        >
          Synthesize →
        </button>
      </div>
    </div>
  </div>
)
  function pillBtn(primary, disabled) {
  return {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: primary ? "rgba(103,77,255,0.65)" : "rgba(255,255,255,0.10)",
    color: "white",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
}
}

export default BrainDump