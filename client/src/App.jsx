import { Navigate, Route, Routes } from "react-router-dom";
import BrainDump from "./pages/BrainDump";
import Synthesize from "./pages/Synthesize";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import { useContract } from "./ContractContext";

function isRouteOverrideEnabled() {
  const envOverride = import.meta.env.VITE_ROUTE_OVERRIDE === "true";

  if (typeof window === "undefined") {
    return envOverride;
  }

  return envOverride || window.localStorage.getItem("routeOverride") === "1";
}

export default function App() {
  const { contract } = useContract();
  const canAccessProtectedRoutes = Boolean(contract) || isRouteOverrideEnabled();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/braindump"
        element={canAccessProtectedRoutes ? <BrainDump /> : <Navigate to="/login" />}
      />
      <Route
        path="/synthesize"
        element={canAccessProtectedRoutes ? <Synthesize /> : <Navigate to="/login" />}
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
