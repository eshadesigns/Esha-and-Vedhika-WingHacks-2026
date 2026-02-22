import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useContract } from "../ContractContext";


const API = (import.meta.env.VITE_API_URL || "/api").trim().replace(/\/$/, "");

function Synthesize() {
  const navigate = useNavigate();
  const location = useLocation();
  const { contract, setContract } = useContract();

  const [ideas, setIdeas] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tasksByIdea, setTasksByIdea] = useState({});
  const [tasksLoading, setTasksLoading] = useState(false);

  const [completedToday, setCompletedToday] = useState(0);
  const [friendMenuOpen, setFriendMenuOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState("");
  const [balances, setBalances] = useState({});
  const [evalMsg, setEvalMsg] = useState("");
  const [evalLoading, setEvalLoading] = useState(false);

  const required = Number(contract?.dailyGoalCount || 0);
  const progressPct = required > 0 ? Math.min(100, Math.round((completedToday / required) * 100)) : 0;
  const currentTasks = selectedId ? tasksByIdea[selectedId] || [] : [];
  const isGoalCompletedByTasks = useCallback(
    (ideaId) => {
      const goalTasks = tasksByIdea[ideaId] || [];
      return goalTasks.length > 0 && goalTasks.every((t) => t.done);
    },
    [tasksByIdea]
  );

  const friends = useMemo(() => {
    if (!contract) return [];
    const fromContract = Array.isArray(contract.friends) ? contract.friends : [];
    const merged = [...fromContract, contract.friendUsername].filter(Boolean);
    return [...new Set(merged)];
  }, [contract]);

  useEffect(() => {
    if (!contract) return;
    setSelectedFriend((prev) => prev || contract.friendUsername || "");
    setBalances(contract.balances || {
      [contract.username]: 500,
      [contract.friendUsername]: 500,
    });
  }, [contract]);

  const fetchTasks = useCallback(async (ideaId, text) => {
    if (!ideaId || !text) {
      return;
    }

    // Keep previously generated tasks for each goal.
    if (tasksByIdea[ideaId]?.length) {
      return;
    }

    setTasksLoading(true);
    try {
      const res = await fetch(`${API}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      const steps = Array.isArray(data.steps) ? data.steps : [];
      setTasksByIdea((prev) => ({
        ...prev,
        [ideaId]: steps.map((s) => ({ text: String(s), done: false, savedForLater: false })),
      }));
    } catch (e) {
      setTasksByIdea((prev) => ({
        ...prev,
        [ideaId]: [{ text: "Could not fetch steps from backend.", done: false, savedForLater: false }],
      }));
    } finally {
      setTasksLoading(false);
    }
  }, [tasksByIdea]);

  useEffect(() => {
    async function loadIdeas() {
      if (location.state?.ideas?.length > 0) {
        const fromState = location.state.ideas.map((i) => ({
          id: i.id,
          text: i.text,
          done: !!i.done,
        }));
        setIdeas(fromState);
        setSelectedId(fromState[0].id);
        fetchTasks(fromState[0].id, fromState[0].text);
        return;
      }

      try {
        const res = await fetch(`${API}/nodes`);
        const nodes = await res.json();
        if (Array.isArray(nodes) && nodes.length > 0) {
          const mapped = nodes.map((n) => ({
            id: n.id,
            text: n.text,
            done: n.status === "done",
          }));
          setIdeas(mapped);
          setSelectedId(mapped[0].id);
          fetchTasks(mapped[0].id, mapped[0].text);
        }
      } catch (e) {
        console.error("Failed to load nodes:", e);
      }
    }

    loadIdeas();
  }, [location.state?.ideas]);

  async function toggleDone(id) {
    const idea = ideas.find((i) => i.id === id);
    if (!idea) return;

    const newDone = !idea.done;
    try {
      await fetch(`${API}/nodes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newDone ? "done" : "active" }),
      });
    } catch (e) {
      // Keep UI optimistic for demo usage.
    }

    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, done: newDone } : i)));
  }

  function selectIdea(idea) {
    setSelectedId(idea.id);
    fetchTasks(idea.id, idea.text);
  }

  function markTaskDone(i) {
    if (!selectedId) return;
    const task = currentTasks[i];
    if (!task || task.done) return;

    setTasksByIdea((prev) => ({
      ...prev,
      [selectedId]: (prev[selectedId] || []).map((t, idx) => (idx === i ? { ...t, done: true } : t)),
    }));
    setCompletedToday((count) => (required > 0 ? Math.min(required, count + 1) : count + 1));
  }

  async function regenTask(i) {
    if (!selectedId) return;
    const currentTask = currentTasks[i];
    if (!currentTask) return;

    try {
      const res = await fetch(`${API}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Break this into ONE tiny 5-minute step: ${currentTask.text}`,
        }),
      });
      const data = await res.json();
      const newStep = Array.isArray(data.steps) && data.steps[0] ? String(data.steps[0]) : null;
      if (!newStep) return;

      setTasksByIdea((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] || []).map((t, idx) =>
          idx === i ? { text: newStep, done: false, savedForLater: false } : t
        ),
      }));
    } catch (e) {
      setTasksByIdea((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] || []).map((t, idx) =>
          idx === i ? { ...t, text: `${t.text} (regenerate failed)` } : t
        ),
      }));
    }
  }

  async function evaluateContract() {
    if (!contract || !selectedFriend) return;

    setEvalMsg("");
    setEvalLoading(true);

    try {
      const res = await fetch(`${API}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: contract.contractId,
          username: contract.username,
          friendUsername: selectedFriend,
          required,
          completed: completedToday,
          stake: Number(contract.stakeAmount || 100),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Evaluate failed");

      setEvalMsg(data.message || "Evaluated.");

      if (data.balances) {
        setBalances(data.balances);
        const updatedContract = { ...contract, balances: data.balances };
        setContract(updatedContract);
      }
    } catch (e) {
      setEvalMsg(e.message || "Evaluate failed");
    } finally {
      setEvalLoading(false);
    }
  }

  function logout() {
    setContract(null);
    localStorage.removeItem("contract");
    navigate("/");
  }

  return (
    <div
      className="synthesize-page"
      style={{
        minHeight: "100vh",
        width: "100vw",
        position: "relative",
        fontFamily: '"Times New Roman", Times, serif',
        background:
          "radial-gradient(900px 500px at 20% 10%, rgba(103,77,255,0.28), transparent 60%)," +
          "radial-gradient(800px 450px at 90% 30%, rgba(0,198,255,0.20), transparent 55%)," +
          "#0b0f17",
        color: "white",
        padding: 28,
        boxSizing: "border-box",
      }}
    >
      <style>
        {`
          .synthesize-page button,
          .synthesize-page input,
          .synthesize-page select,
          .synthesize-page textarea {
            font-family: inherit;
          }
        `}
      </style>

      <button
        onClick={logout}
        title="Log out"
        style={{
          position: "absolute",
          top: 10,
          right: 14,
          width: 100,
          height: 50,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.22)",
          background: "rgba(44, 18, 68, 0.28)",
          color: "white",
          fontSize: 18,
          cursor: "pointer",
          zIndex: 6,
          opacity: 0.80,
        }}
      >
        Logout
      </button>

      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 6 }}>Microtasking</h1>
        <p style={{ opacity: 0.75, marginTop: 0 }}>Here are your actionable items.</p>

        {contract && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginTop: 16 }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  width: "100%",
                  height: 16,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progressPct}%`,
                    background: "rgba(255,255,255,0.9)",
                    transition: "width 200ms ease",
                  }}
                />
              </div>
              <div style={{ marginTop: 8, opacity: 0.8 }}>
                {completedToday}/{required} tasks completed today
              </div>
            </div>

            <div style={{ position: "relative" }}>
              <button
                onClick={() => setFriendMenuOpen((v) => !v)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
                title="Contracts"
              >
                C
              </button>

              {friendMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 52,
                    width: 220,
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(20,20,20,0.95)",
                    padding: 10,
                    zIndex: 20,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Contracts</div>
                  {friends.map((friend) => (
                    <button
                      key={friend}
                      onClick={() => {
                        setSelectedFriend(friend);
                        setFriendMenuOpen(false);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 10px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: selectedFriend === friend ? "rgba(103,77,255,0.55)" : "rgba(255,255,255,0.06)",
                        color: "white",
                        cursor: "pointer",
                        marginBottom: 8,
                      }}
                    >
                      @{friend}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
            alignItems: "start",
            marginTop: 16,
          }}
        >
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
                const isDone = Boolean(idea.done);
                const isTasksDone = isGoalCompletedByTasks(idea.id);
                const showAsDone = isDone || isTasksDone;

                return (
                  <div key={idea.id} style={{ position: "relative", marginBottom: 16 }}>
                    <div
                      style={{
                        position: "absolute",
                        left: -35,
                        top: 14,
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        background: showAsDone ? "rgba(190,190,190,0.42)" : "rgba(103,77,255,0.75)",
                        boxShadow: showAsDone
                          ? "none"
                          : "0 0 18px rgba(103,77,255,0.55), 0 0 40px rgba(0,198,255,0.18)",
                        border: "1px solid rgba(255,255,255,0.22)",
                      }}
                    />

                    <div
                      onClick={() => {
                        if (isSelected) {
                          toggleDone(idea.id);
                        } else {
                          selectIdea(idea);
                        }
                      }}
                      style={{
                        cursor: "pointer",
                        display: "inline-block",
                        padding: "12px 14px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.16)",
                        background: showAsDone
                          ? "rgba(255,255,255,0.10)"
                          : isSelected
                            ? "rgba(103,77,255,0.65)"
                            : "rgba(255,255,255,0.08)",
                        opacity: showAsDone ? 0.45 : 1,
                        textDecoration: showAsDone ? "line-through" : "none",
                        transition: "all 0.2s ease",
                        boxShadow: isSelected && !showAsDone
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
              onClick={() => navigate("/braindump")}
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
              Back
            </button>
          </div>

          <div
            style={{
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              padding: 18,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Small Tasks</h3>

            {tasksLoading ? (
              <p style={{ opacity: 0.7 }}>Generating steps...</p>
            ) : currentTasks.length === 0 && ideas.length > 0 ? (
              <p style={{ opacity: 0.7 }}>Select a goal or check that the backend is running.</p>
            ) : null}

            {currentTasks.map((task, i) => (
              <div
                key={`${task.text}-${i}`}
                style={{
                  background: "rgba(0,0,0,0.22)",
                  padding: 12,
                  borderRadius: 14,
                  marginBottom: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <div
                  style={{
                    marginBottom: 10,
                    opacity: task.done ? 0.65 : 0.95,
                    textDecoration: task.done ? "line-through" : "none",
                  }}
                >
                  {task.text}
                  {task.savedForLater ? " (saved for later)" : ""}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => markTaskDone(i)} style={taskBtn()} disabled={task.done}>
                    {task.done ? "Done" : "Mark Done"}
                  </button>
                  <button onClick={() => regenTask(i)} style={taskBtn(true)}>
                    Regenerate
                  </button>
                </div>
              </div>
            ))}

            {contract && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                <h3 style={{ marginTop: 0 }}>Evaluate Contract</h3>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <select
                    value={selectedFriend}
                    onChange={(e) => setSelectedFriend(e.target.value)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.16)",
                      background: "rgba(255,255,255,0.06)",
                      color: "white",
                    }}
                  >
                    {friends.map((friend) => (
                      <option key={friend} value={friend}>
                        @{friend}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={evaluateContract}
                    disabled={evalLoading || !selectedFriend}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.16)",
                      background: "rgba(255,255,255,0.10)",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    {evalLoading ? "Evaluating..." : "Evaluate Contract"}
                  </button>
                </div>

                {evalMsg && <div style={{ marginTop: 10, opacity: 0.9 }}>{evalMsg}</div>}

                <div style={{ marginTop: 10, opacity: 0.85 }}>
                  <div>
                    <b>@{contract.username}:</b> ${balances[contract.username] ?? 500}
                  </div>
                  <div>
                    <b>@{selectedFriend}:</b> ${balances[selectedFriend] ?? 500}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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

export default Synthesize;
