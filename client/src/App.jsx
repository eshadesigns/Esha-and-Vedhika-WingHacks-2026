import { Routes, Route } from "react-router-dom";
import BrainDump from "./pages/BrainDump";
import Synthesize from "./pages/Synthesize";
import ConstellationBackground from "./components/ConstellationBackground";
function App() {
  return (
    <ConstellationBackground>
      <Routes>
        <Route path="/" element={<BrainDump />} />
        <Route path="/synthesize" element={<Synthesize />} />
      </Routes>
    </ConstellationBackground>
  );
}

export default App;

// The App component defines the routes for the application. 
// It uses the Routes and Route components from react-router-dom to specify which component should be rendered for each path. 
// The "/" path renders the BrainDump component, and the "/synthesize" path renders the Synthesize component.