import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  AlertTriangle,
  LogOut,
  Boxes,
  FileBarChart,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const navigation = [
    {
      label: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Products",
      path: "/products",
      icon: Package,
    },
    {
      label: "Stock Movements",
      path: "/movements",
      icon: ArrowLeftRight,
    },
    {
      label: "Low Stock",
      path: "/low-stock",
      icon: AlertTriangle,
    },
  ];

  if (user?.role === "owner") {
  navigation.push({
    label: "Reports",
    path: "/reports",
    icon: FileBarChart,
  });
}

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Boxes size={23} />
          </div>

          <div>
            <h2>StockLedger</h2>
            <span>Inventory management</span>
          </div>
        </div>

        <div className="sidebar-section-label">
          WORKSPACE
        </div>

        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-profile">
            <div className="user-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>

            <div className="user-details">
              <strong>{user?.name || "User"}</strong>
              <span>{user?.role || "Staff"}</span>
            </div>
          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="topbar-label">SHOP INVENTORY LEDGER</span>
            <h3>Inventory Workspace</h3>
          </div>

          <div className="topbar-user">
            <span>{user?.name}</span>
            <span className="role-badge">{user?.role}</span>
          </div>
        </header>

        <section className="page-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}