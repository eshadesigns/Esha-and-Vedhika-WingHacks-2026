import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div style={pageStyle}>
      <div style={bgOrbOne} />
      <div style={bgOrbTwo} />
      <div style={bgGrid} />

      <div style={cardStyle}>
        <p style={kickerStyle}>CashPact</p>
        <h1 style={titleStyle}>Lock in your daily accountability pact</h1>
        <p style={subtitleStyle}>
          Set a clear daily target, commit money to the challenge, and let progress drive the outcome.
          CashPact helps you and a friend stay consistent.
        </p>

        <div style={chipsRow}>
          <span style={chip}>Shared commitment</span>
          <span style={chip}>Daily progress</span>
          <span style={chip}>Automatic stake logic</span>
        </div>

        <div style={actionsRow}>
          <Link to="/login" style={{ ...buttonStyle, ...primaryButton }}>
            Start a Contract
          </Link>
        </div>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  display: "grid",
  placeItems: "center",
  padding: "30px 16px",
  background:
    "radial-gradient(1000px 460px at 15% 12%, rgba(192, 25, 158, 0.2), transparent 60%)," +
    "radial-gradient(700px 440px at 88% 18%, rgba(0,211,173,0.2), transparent 62%)," +
    "#0f151a",
  color: "#edf3f8",
  fontFamily: '"Manrope", "Avenir Next", "Segoe UI", sans-serif',
};

const bgOrbOne = {
  position: "absolute",
  width: 300,
  height: 300,
  borderRadius: "50%",
  left: -80,
  top: "12%",
  filter: "blur(70px)",
  background: "rgba(139, 41, 174, 0.22)",
  pointerEvents: "none",
};

const bgOrbTwo = {
  position: "absolute",
  width: 360,
  height: 360,
  borderRadius: "50%",
  right: -120,
  top: "30%",
  filter: "blur(80px)",
  background: "rgba(0, 200, 170, 0.2)",
  pointerEvents: "none",
};

const bgGrid = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
  backgroundSize: "28px 28px",
  maskImage: "radial-gradient(circle at center, black 45%, transparent 100%)",
  pointerEvents: "none",
};

const cardStyle = {
  width: "min(590px, 96vw)",
  borderRadius: 26,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "linear-gradient(165deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))",
  boxShadow: "0 22px 80px rgba(0,0,0,0.42)",
  padding: "32px clamp(18px, 5vw, 38px)",
  backdropFilter: "blur(10px)",
  position: "relative",
  zIndex: 2,
};

const kickerStyle = {
  margin: 0,
  fontSize: 12,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  opacity: 0.82,
  fontWeight: 700,
};

const titleStyle = {
  margin: "8px 0 10px",
  fontSize: "clamp(30px, 4vw, 44px)",
  lineHeight: 1.08,
  letterSpacing: "-0.02em",
};

const subtitleStyle = {
  margin: "0 0 16px",
  opacity: 0.85,
  maxWidth: 620,
  lineHeight: 1.5,
};

const chipsRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 22,
};

const chip = {
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  background: "rgba(255,255,255,0.06)",
  opacity: 0.92,
};

const actionsRow = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const buttonStyle = {
  textDecoration: "none",
  textAlign: "center",
  padding: "13px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.2)",
  fontFamily: '"Manrope", "Avenir Next", "Segoe UI", sans-serif',
  fontWeight: 800,
};

const primaryButton = {
  background: "linear-gradient(120deg, #3d7556, #68299f)",
  color: "#ebecee",
  boxShadow: "0 10px 30px rgba(189, 150, 119, 0.35)",
};

