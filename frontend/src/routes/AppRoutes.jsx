import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "../components/ProtectedRoute";
import AppLayout from "../layouts/AppLayout";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Products from "../pages/Products";
import StockMovements from "../pages/StockMovements";
import LowStock from "../pages/LowStock";
import { useAuth } from "../context/AuthContext";
import Reports from "../pages/Reports";

export default function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/movements" element={<StockMovements />} />
          <Route path="/low-stock" element={<LowStock />} />
          <Route
            path="/reports"
            element={
              user?.role === "owner" ? (
                <Reports />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
