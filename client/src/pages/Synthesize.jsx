import { useNavigate, useLocation } from "react-router-dom"
import { useState, useEffect } from "react"

function Synthesize() {
  const navigate = useNavigate()
  const location = useLocation()

  const [ideas, setIdeas] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    if (location.state?.ideas) {
      setIdeas(location.state.ideas)
      if (location.state.ideas.length > 0) {
        setSelectedId(location.state.ideas[0].id)
        setTasks(makeTasks(location.state.ideas[0].text))
      }
    }
  }, [location.state])

  function makeTasks(text) {
    return [
      `Write what “done” looks like for: ${text}`,
      `Break ${text} into 3 sub-steps`,
      `Do the smallest step in 10 minutes`
    ]
  }

  function toggleDone(id) {
    setIdeas(prev =>
      prev.map(i =>
        i.id === id ? { ...i, done: !i.done } : i
      )
    )
  }

  function selectIdea(idea) {
    setSelectedId(idea.id)
    setTasks(makeTasks(idea.text))
  }

  function markTaskDone(i) {
    setTasks(prev => prev.map((t, idx) => idx === i ? t + " ✓" : t))
  }

  function regenTask(i) {
    setTasks(prev =>
      prev.map((t, idx) =>
        idx === i ? "Try a smaller step: 5 minutes only" : t
      )
    )
  }

  function sendFuture(i) {
    setTasks(prev =>
      prev.map((t, idx) =>
        idx === i ? t + " (saved for later)" : t
      )
    )
  }

  return (
  <div
    style={{
      minHeight: "100vh",
      width: "100vw",
      background:
        "radial-gradient(900px 500px at 20% 10%, rgba(103,77,255,0.28), transparent 60%)," +
        "radial-gradient(800px 450px at 90% 30%, rgba(0,198,255,0.20), transparent 55%)," +
        "#0b0f17",
      color: "white",
      padding: 28,
      boxSizing: "border-box",
    }}
  >
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 6 }}>Synthesize</h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>
        Organized goals + actionable steps.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
          alignItems: "start",
          marginTop: 16,
        }}
      >
        {/* LEFT: Vertical timeline */}
        <div
          style={{
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            padding: 18,
            position: "relative",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Goals</h3>

          <div style={{ position: "relative", paddingLeft: 44 }}>
            {/* vertical line */}
            <div
              style={{
                position: "absolute",
                left: 18,
                top: 6,
                bottom: 6,
                width: 2,
                background: "rgba(255,255,255,0.14)",
                borderRadius: 999,
              }}
            />

            {ideas.map((idea) => {
              const isSelected = selectedId === idea.id;
              const isDone = !!idea.done;

              return (
                <div
                  key={idea.id}
                  style={{
                    position: "relative",
                    marginBottom: 16,
                  }}
                >
                  {/* node dot */}
                  <div
                    style={{
                      position: "absolute",
                      left: -35,
                      top: 14,
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: isDone
                        ? "rgba(255,255,255,0.18)"
                        : "rgba(103,77,255,0.75)",
                      boxShadow: isDone
                        ? "none"
                        : "0 0 18px rgba(103,77,255,0.55), 0 0 40px rgba(0,198,255,0.18)",
                      border: "1px solid rgba(255,255,255,0.22)",
                    }}
                  />

                  {/* goal pill */}
                  <div
                    onClick={() => {
                      // click once = select, click again (if selected) = toggle done
                      if (isSelected) toggleDone(idea.id);
                      else selectIdea(idea);
                    }}
                    style={{
                      cursor: "pointer",
                      display: "inline-block",
                      padding: "12px 14px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.16)",
                      background: isSelected
                        ? "rgba(103,77,255,0.65)"
                        : "rgba(255,255,255,0.08)",
                      opacity: isDone ? 0.45 : 1,
                      textDecoration: isDone ? "line-through" : "none",
                      transition: "all 0.2s ease",
                      boxShadow: isSelected
                        ? "0 0 22px rgba(103,77,255,0.55), 0 0 55px rgba(0,198,255,0.20)"
                        : "none",
                    }}
                  >
                    {idea.text}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => navigate("/")}
            style={{
              marginTop: 10,
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
        </div>

        {/* RIGHT: Tasks */}
        <div
          style={{
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            padding: 18,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Small Tasks</h3>

          {tasks.map((task, i) => (
            <div
              key={i}
              style={{
                background: "rgba(0,0,0,0.22)",
                padding: 12,
                borderRadius: 14,
                marginBottom: 12,
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <div style={{ marginBottom: 10, opacity: 0.95 }}>{task}</div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => markTaskDone(i)} style={taskBtn()}>
                  Done
                </button>
                <button onClick={() => regenTask(i)} style={taskBtn(true)}>
                  Regenerate
                </button>
                <button onClick={() => sendFuture(i)} style={taskBtn(true)}>
                  Send to future
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// helper
function taskBtn(ghost = false) {
  return {
    padding: "9px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: ghost ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.10)",
    color: "white",
    cursor: "pointer",
  };
}
}

export default Synthesize
