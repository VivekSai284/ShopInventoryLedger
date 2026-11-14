
import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";

const formatNumber = (value) =>
  new Intl.NumberFormat("en-IN").format(value || 0);

const formatDate = (value) => {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const movementLabel = (type) => {
  const labels = {
    opening: "Opening stock",
    purchase: "Purchase",
    sale: "Sale",
    return: "Return",
    adjustment: "Adjustment",
  };

  return labels[type] || type || "Movement";
};

export default function Dashboard() {
  const { user } = useAuth();

  const [products, setProducts] = useState([]);
  const [stockByProduct, setStockByProduct] = useState({});
  const [recentMovements, setRecentMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        // Load all active products, following the API pagination.
        const firstResponse = await api.get("/products", {
          params: { page: 1 },
        });

        const firstData = firstResponse.data.data;
        const allProducts = firstData.products || [];
        const totalPages = firstData.pagination?.totalPages || 1;

        for (let page = 2; page <= totalPages; page += 1) {
          const response = await api.get("/products", {
            params: { page },
          });

          allProducts.push(...(response.data.data.products || []));
        }

        if (!isActive) return;

        setProducts(allProducts);

        // Load each product's current ledger stock and latest movements.
        const results = await Promise.all(
          allProducts.map(async (product) => {
            const [stockResult, historyResult] = await Promise.allSettled([
              api.get(`/stock/${product._id}/stock`),
              api.get(`/stock/${product._id}/history`, {
                params: { page: 1, limit: 5 },
              }),
            ]);

            const stock =
              stockResult.status === "fulfilled"
                ? stockResult.value.data.data.currentStock
                : null;

            const movements =
              historyResult.status === "fulfilled"
                ? historyResult.value.data.data.movements || []
                : [];

            return {
              product,
              stock,
              movements,
            };
          })
        );

        if (!isActive) return;

        const stockMap = {};
        const movementList = [];

        results.forEach(({ product, stock, movements }) => {
          if (stock !== null && stock !== undefined) {
            stockMap[product._id] = stock;
          }

          movements.forEach((movement) => {
            movementList.push({
              ...movement,
              productName: product.name,
              productSku: product.sku,
            });
          });
        });

        movementList.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        setStockByProduct(stockMap);
        setRecentMovements(movementList.slice(0, 8));
      } catch (err) {
        if (!isActive) return;

        setError(
          err.response?.data?.message ||
            "Unable to load dashboard data. Please try again."
        );
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadDashboard();

    return () => {
      isActive = false;
    };
  }, []);

  const productsWithStock = products.filter(
    (product) => stockByProduct[product._id] !== undefined
  );

  const lowStockProducts = productsWithStock.filter((product) => {
    const stock = stockByProduct[product._id];
    return stock > 0 && stock <= product.lowStockThreshold;
  });

  const outOfStockProducts = productsWithStock.filter(
    (product) => stockByProduct[product._id] === 0
  );

  const totalStock = productsWithStock.reduce(
    (total, product) => total + stockByProduct[product._id],
    0
  );

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-spinner" />
        <p>Loading your inventory dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <h1>Dashboard</h1>
          <p>
            Welcome back, {user?.name || "User"}. Here's your inventory
            overview.
          </p>
        </div>
        <span className="dashboard-role">
          {user?.role === "owner" ? "Owner" : "Staff"}
        </span>
      </div>

      {error && (
        <div className="dashboard-error">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      )}

      <section className="dashboard-stats">
        <article className="dashboard-stat">
          <div className="stat-icon products-icon">P</div>
          <div>
            <p>Active Products</p>
            <h2>{formatNumber(products.length)}</h2>
          </div>
        </article>

        <article className="dashboard-stat">
          <div className="stat-icon stock-icon">S</div>
          <div>
            <p>Total Stock Quantity</p>
            <h2>{formatNumber(totalStock)}</h2>
            <span>Combined quantity across product units</span>
          </div>
        </article>

        <article className="dashboard-stat">
          <div className="stat-icon low-icon">!</div>
          <div>
            <p>Low Stock Products</p>
            <h2>{formatNumber(lowStockProducts.length)}</h2>
          </div>
        </article>

        <article className="dashboard-stat">
          <div className="stat-icon empty-icon">0</div>
          <div>
            <p>Out of Stock</p>
            <h2>{formatNumber(outOfStockProducts.length)}</h2>
          </div>
        </article>
      </section>

      <section className="dashboard-content-grid">
        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Low Stock Alerts</h2>
              <p>Products that need restocking</p>
            </div>
            <span className="panel-count">
              {lowStockProducts.length}
            </span>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="dashboard-empty">
              <h3>All good!</h3>
              <p>No low-stock products found.</p>
            </div>
          ) : (
            <div className="dashboard-table-wrap">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current Stock</th>
                    <th>Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.slice(0, 8).map((product) => (
                    <tr key={product._id}>
                      <td>
                        <strong>{product.name}</strong>
                        <small>{product.sku}</small>
                      </td>
                      <td>
                        {formatNumber(stockByProduct[product._id])}{" "}
                        {product.unit}
                      </td>
                      <td>
                        {formatNumber(product.lowStockThreshold)}{" "}
                        {product.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent Stock Movements</h2>
              <p>Latest inventory activity</p>
            </div>
            <span className="panel-count">
              {recentMovements.length}
            </span>
          </div>

          {recentMovements.length === 0 ? (
            <div className="dashboard-empty">
              <h3>No movements yet</h3>
              <p>Stock activity will appear here.</p>
            </div>
          ) : (
            <div className="movement-list">
              {recentMovements.map((movement) => (
                <div
                  className="movement-item"
                  key={movement._id}
                >
                  <div className="movement-info">
                    <strong>{movementLabel(movement.type)}</strong>
                    <span>{movement.productName}</span>
                    <small>{formatDate(movement.createdAt)}</small>
                  </div>
                  <div className="movement-quantity">
                    {formatNumber(movement.quantity)}
                    <small>{movement.productSku}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      {outOfStockProducts.length > 0 && (
        <section className="dashboard-panel out-of-stock-panel">
          <div className="panel-heading">
            <div>
              <h2>Out of Stock Products</h2>
              <p>These products currently have zero available stock</p>
            </div>
            <span className="panel-count">
              {outOfStockProducts.length}
            </span>
          </div>

          <div className="out-of-stock-list">
            {outOfStockProducts.slice(0, 8).map((product) => (
              <span key={product._id}>
                {product.name} ({product.sku})
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
