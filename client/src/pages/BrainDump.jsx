import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContract } from "../ContractContext";

const API = (import.meta.env.VITE_API_URL || "/api").trim().replace(/\/$/, "");

const BUBBLE_MAX_WIDTH = 260;
const BUBBLE_MIN_WIDTH = 130;
const BUBBLE_PADDING_X = 24;
const BUBBLE_PADDING_Y = 20;
const BUBBLE_LINE_HEIGHT = 18;
const BUBBLE_GAP = 14;
const LINE_SCORE_THRESHOLD = 0.12;
const CENTER_EXCLUSION_WIDTH_RATIO = 0.34;
const CENTER_EXCLUSION_HEIGHT_RATIO = 0.24;
const CENTER_EXCLUSION_MIN_WIDTH = 260;
const CENTER_EXCLUSION_MIN_HEIGHT = 130;
const LOGOUT_EXCLUSION_TOP = 12;
const LOGOUT_EXCLUSION_LEFT = 10;
const LOGOUT_EXCLUSION_WIDTH = 120;
const LOGOUT_EXCLUSION_HEIGHT = 80;

function BrainDump() {
  const navigate = useNavigate();
  const { setContract } = useContract();

  const [ideas, setIdeas] = useState([]);
  const [text, setText] = useState("");
  const [similarities, setSimilarities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sceneSize, setSceneSize] = useState({ width: 0, height: 0 });
  const sceneRef = useRef(null);

  function addIdea() {
    if (!text.trim()) return;
    const newIdea = { id: `local-${Date.now()}`, text: text.trim(), done: false };
    setIdeas((prev) => [...prev, newIdea]);
    setText("");
  }

  useEffect(() => {
    async function loadNodes() {
      try {
        const res = await fetch(`${API}/nodes`);
        const nodes = await res.json();
        if (Array.isArray(nodes)) {
          setIdeas(
            nodes.map((n) => ({
              id: n.id,
              text: n.text,
              done: n.status === "done",
            }))
          );
        }
      } catch (e) {
        console.error("Failed to load nodes:", e);
      } finally {
        setLoading(false);
      }
    }
    loadNodes();
  }, []);

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;

    const updateSize = () => {
      setSceneSize({ width: el.clientWidth, height: el.clientHeight });
    };

    updateSize();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateSize);
      observer.observe(el);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    if (ideas.length < 2) {
      setSimilarities([]);
      return;
    }

    function computeLocalSimilarities(arr) {
      const toks = (s) => s.toLowerCase().split(/\W+/).filter(Boolean);
      const sets = arr.map((t) => new Set(toks(t)));
      const pairs = [];

      for (let i = 0; i < sets.length; i++) {
        for (let j = i + 1; j < sets.length; j++) {
          const a = sets[i];
          const b = sets[j];
          const inter = Array.from(a).filter((w) => b.has(w)).length;
          const union = new Set([...a, ...b]).size || 1;
          pairs.push({ i, j, score: inter / union });
        }
      }

      return pairs.sort((x, y) => y.score - x.score);
    }

    async function fetchSimilarities() {
      try {
        const res = await fetch(`${API}/similarity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ideas: ideas.map((i) => i.text) }),
        });
        const data = await res.json();
        if (data && Array.isArray(data.similarities) && data.similarities.length) {
          setSimilarities(data.similarities);
        } else {
          setSimilarities(computeLocalSimilarities(ideas.map((i) => i.text)));
        }
      } catch (e) {
        setSimilarities(computeLocalSimilarities(ideas.map((i) => i.text)));
      }
    }

    fetchSimilarities();
  }, [ideas]);

  const placements = useMemo(() => {
    if (!sceneSize.width || !sceneSize.height || ideas.length === 0) return [];

    const placed = [];
    const exclusionZones = [getCenterExclusion(sceneSize), getTopLeftExclusion(sceneSize)];

    ideas.forEach((idea, idx) => {
      const box = estimateBubbleSize(idea.text);
      const seed = hashString(`${idea.id}-${idea.text}-${idx}`);
      const rng = createRng(seed);

      let candidate = null;
      const maxAttempts = 220;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = randomBetween(
          rng,
          box.width / 2 + BUBBLE_GAP,
          sceneSize.width - box.width / 2 - BUBBLE_GAP
        );
        const y = randomBetween(
          rng,
          box.height / 2 + BUBBLE_GAP,
          sceneSize.height - box.height / 2 - BUBBLE_GAP
        );

        const rect = rectFromCenter(x, y, box.width, box.height);
        if (intersectsAnyExclusion(rect, exclusionZones)) continue;
        if (!isOverlapping(rect, placed, BUBBLE_GAP)) {
          candidate = { ...rect, x, y, width: box.width, height: box.height };
          break;
        }
      }

      if (!candidate) {
        candidate = findGridFallback(box, placed, sceneSize, exclusionZones);
      }

      placed.push(candidate);
    });

    return placed;
  }, [ideas, sceneSize]);

  const visibleConnections = useMemo(() => {
    if (ideas.length < 2) return [];

    return similarities.filter(
      (sim) => sim && typeof sim.i === "number" && typeof sim.j === "number" && sim.score >= LINE_SCORE_THRESHOLD
    );
  }, [ideas, similarities]);

  function goToSynthesize() {
    navigate("/synthesize", { state: { ideas } });
  }

  function logout() {
    setContract(null);
    localStorage.removeItem("contract");
    navigate("/");
  }

  return (
    <div
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
      <style>
        {`
          @keyframes cashFloat {
            0% { transform: translate(-50%, -50%) translateY(0px); }
            50% { transform: translate(-50%, -50%) translateY(-22px); }
            100% { transform: translate(-50%, -50%) translateY(0px); }
          }

          @keyframes cashGlow {
            0% { filter: drop-shadow(0 0 0 rgba(157, 238, 255, 0)); }
            50% { filter: drop-shadow(0 0 16px rgba(157, 238, 255, 0.35)); }
            100% { filter: drop-shadow(0 0 0 rgba(157, 238, 255, 0)); }
          }

          @keyframes bubbleDrift {
            0% { transform: translate(-50%, -50%) translate(0px, 0px); }
            50% { transform: translate(-50%, -50%) translate(var(--drift-x), var(--drift-y)); }
            100% { transform: translate(-50%, -50%) translate(0px, 0px); }
          }
        `}
      </style>

      <button
        onClick={logout}
        title="Log out"
        style={{
          position: "absolute",
          top: 16,
          left: 14,
          width: 100,
          height: 60,
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

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          animation: "cashFloat 3.2s cubic-bezier(0.22, 0.61, 0.36, 1) infinite, cashGlow 2.2s ease-in-out infinite",
          textAlign: "center",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "0.04em" }}>CashPact</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>{loading ? "Loading..." : "Progress. Partnership. Payoff."}</div>
      </div>

      <div
        ref={sceneRef}
        style={{
          position: "relative",
          height: "calc(100vh - 170px)",
        }}
      >
        <svg
          width="100%"
          height="100%"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 0,
          }}
        >
          {visibleConnections.map((sim) => {
            const { i, j, score } = sim;
            if (!placements[i] || !placements[j]) return null;
            return (
              <line
                key={`${ideas[i]?.id || i}-${ideas[j]?.id || j}`}
                x1={placements[i].x}
                y1={placements[i].y}
                x2={placements[j].x}
                y2={placements[j].y}
                stroke={score >= LINE_SCORE_THRESHOLD ? "rgba(67, 72, 67, 0.72)" : "rgba(148, 147, 147, 0.55)"}
                strokeWidth="3"
              />
            );
          })}
        </svg>

        {ideas.map((idea, idx) => {
          const placement = placements[idx];
          if (!placement) return null;
          const driftSeed = hashString(`${idea.id}-drift`);
          const driftX = ((driftSeed % 7) - 3) * 1.6;
          const driftY = (((driftSeed >> 3) % 7) - 3) * 1.4;
          const driftDuration = 4.8 + ((driftSeed % 25) / 10);
          const driftDelay = -((driftSeed % 14) / 10);

          return (
            <div
              key={idea.id}
              className="idea-bubble"
              style={{
                "--drift-x": `${driftX}px`,
                "--drift-y": `${driftY}px`,
                position: "absolute",
                left: placement.x,
                top: placement.y,
                transform: "translate(-50%, -50%)",
                animation: `bubbleDrift ${driftDuration}s ease-in-out ${driftDelay}s infinite`,
                width: placement.width,
                minHeight: placement.height,
                padding: "10px 12px",
                borderRadius: 18,
                textAlign: "center",
                whiteSpace: "normal",
                overflowWrap: "anywhere",
                lineHeight: `${BUBBLE_LINE_HEIGHT}px`,
                background: "rgba(150,120,255,0.16)",
                border: "1px solid rgba(255,255,255,0.18)",
                zIndex: 1,
                boxShadow: "0 0 18px rgba(103,77,255,0.45), 0 0 40px rgba(0,198,255,0.18)",
              }}
            >
              {idea.text}
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 18,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
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
            placeholder="Type a goal..."
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              color: "white",
              fontFamily: "inherit",
              fontSize: 15,
              padding: "10px 12px",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") addIdea();
            }}
          />

          <button onClick={addIdea} disabled={!text.trim()} className="brain-btn" style={pillBtn(false, !text.trim())}>
            Add
          </button>

          <button
            onClick={goToSynthesize}
            disabled={ideas.length === 0}
            className="brain-btn brain-btn-primary"
            style={pillBtn(true, ideas.length === 0)}
          >
            Minimize!
          </button>
        </div>
      </div>
    </div>
  );

  function pillBtn(primary, disabled) {
    return {
      padding: "10px 14px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.18)",
      background: primary ? "rgba(103,77,255,0.65)" : "rgba(255,255,255,0.10)",
      color: "white",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.45 : 1,
      fontWeight: 600,
      whiteSpace: "nowrap",
      transition: "box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease",
    };
  }
}

function estimateBubbleSize(text) {
  const safeText = (text || "").trim() || "Untitled";
  const avgCharWidth = 2.2;
  const longestWord = safeText.split(/\s+/).reduce((max, word) => Math.max(max, word.length), 0);
  const longestWordWidth = longestWord * avgCharWidth;
  const targetWidth = Math.min(BUBBLE_MAX_WIDTH, Math.max(BUBBLE_MIN_WIDTH, longestWordWidth + BUBBLE_PADDING_X));

  const charsPerLine = Math.max(10, Math.floor((targetWidth - BUBBLE_PADDING_X) / avgCharWidth));
  const lineCount = Math.max(1, Math.ceil(safeText.length / charsPerLine));
  const height = lineCount * BUBBLE_LINE_HEIGHT + BUBBLE_PADDING_Y;

  return {
    width: targetWidth,
    height,
  };
}

function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomBetween(rng, min, max) {
  if (max <= min) return min;
  return min + (max - min) * rng();
}

function rectFromCenter(x, y, width, height) {
  return {
    left: x - width / 2,
    right: x + width / 2,
    top: y - height / 2,
    bottom: y + height / 2,
    width,
    height,
  };
}

function isOverlapping(candidate, placed, gap) {
  return placed.some((p) => {
    const noOverlap =
      candidate.right + gap <= p.left ||
      candidate.left >= p.right + gap ||
      candidate.bottom + gap <= p.top ||
      candidate.top >= p.bottom + gap;
    return !noOverlap;
  });
}

function findGridFallback(box, placed, sceneSize, exclusionZones) {
  const minX = box.width / 2 + BUBBLE_GAP;
  const maxX = sceneSize.width - box.width / 2 - BUBBLE_GAP;
  const minY = box.height / 2 + BUBBLE_GAP;
  const maxY = sceneSize.height - box.height / 2 - BUBBLE_GAP;

  const step = 20;
  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      const rect = rectFromCenter(x, y, box.width, box.height);
      if (intersectsAnyExclusion(rect, exclusionZones)) continue;
      if (!isOverlapping(rect, placed, BUBBLE_GAP)) {
        return { ...rect, x, y, width: box.width, height: box.height };
      }
    }
  }

  const fallbackPoints = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: minX, y: maxY },
    { x: maxX, y: maxY },
    { x: minX, y: Math.max(minY, Math.min(sceneSize.height / 2, maxY)) },
    { x: maxX, y: Math.max(minY, Math.min(sceneSize.height / 2, maxY)) },
  ];

  for (const point of fallbackPoints) {
    const rect = rectFromCenter(point.x, point.y, box.width, box.height);
    if (intersectsAnyExclusion(rect, exclusionZones)) continue;
    if (!isOverlapping(rect, placed, BUBBLE_GAP)) {
      return { ...rect, x: point.x, y: point.y, width: box.width, height: box.height };
    }
  }

  const fallbackX = minX;
  const fallbackY = minY;
  const fallbackRect = rectFromCenter(fallbackX, fallbackY, box.width, box.height);

  return {
    ...fallbackRect,
    x: fallbackX,
    y: fallbackY,
    width: box.width,
    height: box.height,
  };
}

function getCenterExclusion(sceneSize) {
  const width = Math.max(CENTER_EXCLUSION_MIN_WIDTH, sceneSize.width * CENTER_EXCLUSION_WIDTH_RATIO);
  const height = Math.max(CENTER_EXCLUSION_MIN_HEIGHT, sceneSize.height * CENTER_EXCLUSION_HEIGHT_RATIO);
  const centerX = sceneSize.width / 2;
  const centerY = sceneSize.height / 2;

  return {
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: centerY - height / 2,
    bottom: centerY + height / 2,
  };
}

function getTopLeftExclusion(sceneSize) {
  return {
    left: LOGOUT_EXCLUSION_LEFT,
    right: Math.min(sceneSize.width, LOGOUT_EXCLUSION_LEFT + LOGOUT_EXCLUSION_WIDTH),
    top: LOGOUT_EXCLUSION_TOP,
    bottom: Math.min(sceneSize.height, LOGOUT_EXCLUSION_TOP + LOGOUT_EXCLUSION_HEIGHT),
  };
}

function intersectsAnyExclusion(rect, exclusions) {
  return exclusions.some((zone) => intersectsExclusion(rect, zone));
}

function intersectsExclusion(rect, exclusion) {
  return !(
    rect.right <= exclusion.left ||
    rect.left >= exclusion.right ||
    rect.bottom <= exclusion.top ||
    rect.top >= exclusion.bottom
  );
}

export default BrainDump;
