import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  AlertTriangle,
  ArrowDownToLine,
  Package,
  RefreshCw,
  Search,
  TrendingDown,
  XCircle,
} from "lucide-react";

import api from "../api/axios";
import "./LowStock.css";
import { useLocation } from "react-router-dom";

function getErrorMessage(error) {
  return (
    error.response?.data?.message ||
    error.response?.data?.errors?.[0]?.message ||
    error.message ||
    "Unable to load inventory. Please try again."
  );
}

export default function LowStock() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadInventory = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      // Fetch the first page to discover how many pages exist.
      const firstResponse = await api.get("/products", {
        params: { page: 1, limit: 100 },
      });

      const firstData = firstResponse.data?.data || {};
      const firstProducts = firstData.products || [];
      const totalPages = Math.max(
        1,
        Number(firstData.pagination?.totalPages || 1),
      );

      let allProducts = [...firstProducts];

      // Fetch remaining product pages if necessary.
      if (totalPages > 1) {
        const remainingPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            api.get("/products", {
              params: { page: index + 2, limit: 100 },
            }),
          ),
        );

        remainingPages.forEach((response) => {
          const pageProducts = response.data?.data?.products || [];
          allProducts = [...allProducts, ...pageProducts];
        });
      }

      // Get the current ledger balance for every active product.
      const stockResults = await Promise.all(
        allProducts.map(async (product) => {
          try {
            const response = await api.get(`/stock/${product._id}/stock`);
            const stockData = response.data?.data || {};

            return {
              ...product,
              currentStock: Number(stockData.currentStock),
              stockUnit: stockData.unit || product.unit,
              stockError: false,
            };
          } catch {
            return {
              ...product,
              currentStock: null,
              stockUnit: product.unit,
              stockError: true,
            };
          }
        }),
      );

      setInventory(stockResults);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const categories = useMemo(() => {
    return [
      ...new Set(inventory.map((item) => item.category).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
  }, [inventory]);

  const getStatus = (product) => {
    if (
      product.stockError ||
      product.currentStock === null ||
      !Number.isFinite(product.currentStock)
    ) {
      return "unknown";
    }

    if (product.currentStock <= 0) {
      return "out";
    }

    if (product.currentStock <= Number(product.lowStockThreshold || 0)) {
      return "low";
    }

    return "healthy";
  };

  const outOfStockCount = inventory.filter(
    (product) => getStatus(product) === "out",
  ).length;

  const lowStockCount = inventory.filter(
    (product) => getStatus(product) === "low",
  ).length;

  const unknownCount = inventory.filter(
    (product) => getStatus(product) === "unknown",
  ).length;

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return inventory
      .filter((product) => {
        const matchesSearch =
          !normalizedSearch ||
          product.name?.toLowerCase().includes(normalizedSearch) ||
          product.sku?.toLowerCase().includes(normalizedSearch);

        const matchesCategory =
          !categoryFilter || product.category === categoryFilter;

        const status = getStatus(product);

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "low" && status === "low") ||
          (statusFilter === "out" && status === "out") ||
          (statusFilter === "unknown" && status === "unknown");

        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        const priority = { out: 0, low: 1, unknown: 2, healthy: 3 };
        return priority[getStatus(a)] - priority[getStatus(b)];
      });
  }, [inventory, search, categoryFilter, statusFilter]);

  const formatStock = (value) => {
    if (value === null || !Number.isFinite(value)) return "Unavailable";
    return value.toLocaleString();
  };

  const handleRestock = (product) => {
    navigate("/movements", {
      state: {
        productId: product._id,
        movementType: "purchase",
      },
    });
  };

  return (
    <div className="low-stock-page">
      <div className="low-stock-header">
        <div>
          <span className="low-stock-eyebrow">INVENTORY OVERVIEW</span>
          <h1>Low Stock Alerts</h1>
          <p>Monitor products that need attention or replenishment.</p>
        </div>

        <button
          type="button"
          className="low-stock-refresh"
          onClick={() => loadInventory(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw
            size={16}
            className={refreshing ? "low-stock-spinning" : ""}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="low-stock-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            <XCircle size={17} />
          </button>
        </div>
      )}

      <section className="low-stock-stats">
        <article className="low-stock-stat-card">
          <div className="low-stock-stat-icon out-icon">
            <XCircle size={21} />
          </div>
          <div>
            <span>Out of Stock</span>
            <strong>{loading ? "—" : outOfStockCount}</strong>
            <small>Products with zero stock</small>
          </div>
        </article>

        <article className="low-stock-stat-card">
          <div className="low-stock-stat-icon low-icon">
            <TrendingDown size={21} />
          </div>
          <div>
            <span>Low Stock</span>
            <strong>{loading ? "—" : lowStockCount}</strong>
            <small>At or below the threshold</small>
          </div>
        </article>

        <article className="low-stock-stat-card">
          <div className="low-stock-stat-icon total-icon">
            <Package size={21} />
          </div>
          <div>
            <span>Active Products</span>
            <strong>{loading ? "—" : inventory.length}</strong>
            <small>Products checked</small>
          </div>
        </article>
      </section>

      <section className="low-stock-content">
        <div className="low-stock-content-header">
          <div>
            <h2>Products Requiring Attention</h2>
            <p>
              {loading
                ? "Checking product stock..."
                : `${filteredProducts.length} matching products`}
              {unknownCount > 0 && !loading
                ? ` · ${unknownCount} stock balance(s) could not be loaded`
                : ""}
            </p>
          </div>
        </div>

        <div className="low-stock-filters">
          <div className="low-stock-search">
            <Search size={17} />
            <input
              type="text"
              placeholder="Search product name or SKU..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="out">Out of stock</option>
            <option value="low">Low stock</option>
            <option value="unknown">Stock unavailable</option>
          </select>
        </div>

        <div className="low-stock-table-wrapper">
          <table className="low-stock-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Threshold</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="low-stock-table-message">
                    Loading inventory and checking stock balances...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="low-stock-table-message">
                    {inventory.length === 0
                      ? "No active products found."
                      : "No products match these filters."}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const status = getStatus(product);

                  return (
                    <tr key={product._id}>
                      <td>
                        <div className="low-stock-product-name">
                          <strong>{product.name}</strong>
                          <span>{product.sku}</span>
                        </div>
                      </td>

                      <td>{product.category || "—"}</td>

                      <td>
                        <strong
                          className={
                            status === "out"
                              ? "stock-number-out"
                              : status === "low"
                                ? "stock-number-low"
                                : ""
                          }
                        >
                          {formatStock(product.currentStock)}
                        </strong>{" "}
                        {product.stockUnit || product.unit}
                      </td>

                      <td>
                        {Number(product.lowStockThreshold || 0)} {product.unit}
                      </td>

                      <td>
                        <span className={`low-stock-status status-${status}`}>
                          {status === "out"
                            ? "Out of Stock"
                            : status === "low"
                              ? "Low Stock"
                              : status === "unknown"
                                ? "Unavailable"
                                : "Healthy"}
                        </span>
                      </td>

                      <td>
                        {status === "low" || status === "out" ? (
                          <button
                            type="button"
                            className="low-stock-action"
                            onClick={() => handleRestock(product)}
                          >
                            <ArrowDownToLine size={15} />
                            {isOwner ? "Restock" : "View Movements"}
                          </button>
                        ) : status === "unknown" ? (
                          <button
                            type="button"
                            className="low-stock-action secondary"
                            onClick={() => loadInventory(true)}
                          >
                            Retry
                          </button>
                        ) : (
                          <span className="low-stock-no-action">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
