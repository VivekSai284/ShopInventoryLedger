
import { useCallback, useEffect, useState } from "react";
import {
  Download,
  RefreshCw,
  FileBarChart,
  Package,
  AlertTriangle,
  CircleDollarSign,
  Boxes,
} from "lucide-react";

import api from "../api/axios";
import "./Reports.css";

const PAGE_LIMIT = 10;

const formatNumber = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value || 0);

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

const movementLabels = {
  opening: "Opening stock",
  purchase: "Purchase",
  sale: "Sale",
  return: "Return",
  adjustment: "Adjustment",
};

const downloadCsv = (filename, headers, rows) => {
  const escapeCell = (value) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const csv = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
};

const getErrorMessage = (error) =>
  error.response?.data?.message ||
  "Unable to load report data. Please try again.";

export default function Reports() {
  const [summary, setSummary] = useState(null);

  const [inventory, setInventory] = useState([]);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryPagination, setInventoryPagination] = useState(null);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryCategory, setInventoryCategory] = useState("");

  const [movements, setMovements] = useState([]);
  const [movementPage, setMovementPage] = useState(1);
  const [movementPagination, setMovementPagination] = useState(null);
  const [movementType, setMovementType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async () => {
    const response = await api.get("/reports/summary");
    setSummary(response.data.data);
  }, []);

  const loadInventory = useCallback(async () => {
    setLoadingInventory(true);

    try {
      const response = await api.get("/reports/inventory", {
        params: {
          page: inventoryPage,
          limit: PAGE_LIMIT,
          search: inventorySearch || undefined,
          category: inventoryCategory || undefined,
        },
      });

      setInventory(response.data.data.inventory || []);
      setInventoryPagination(response.data.data.pagination);
    } finally {
      setLoadingInventory(false);
    }
  }, [inventoryPage, inventorySearch, inventoryCategory]);

  const loadMovements = useCallback(async () => {
    setLoadingMovements(true);

    try {
      const params = {
        page: movementPage,
        limit: PAGE_LIMIT,
        type: movementType || undefined,
      };

      if (dateFrom) {
        params.dateFrom = new Date(
          `${dateFrom}T00:00:00`
        ).toISOString();
      }

      if (dateTo) {
        params.dateTo = new Date(
          `${dateTo}T23:59:59.999`
        ).toISOString();
      }

      const response = await api.get("/reports/movements", {
        params,
      });

      setMovements(response.data.data.movements || []);
      setMovementPagination(response.data.data.pagination);
    } finally {
      setLoadingMovements(false);
    }
  }, [movementPage, movementType, dateFrom, dateTo]);

  const loadAll = useCallback(async () => {
    setError("");
    setLoadingSummary(true);

    try {
      await loadSummary();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingSummary(false);
    }
  }, [loadSummary]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadInventory().catch((err) => {
      setError(getErrorMessage(err));
    });
  }, [loadInventory]);

  useEffect(() => {
    loadMovements().catch((err) => {
      setError(getErrorMessage(err));
    });
  }, [loadMovements]);

  const handleInventorySearch = (event) => {
    setInventorySearch(event.target.value);
    setInventoryPage(1);
  };

  const handleCategoryChange = (event) => {
    setInventoryCategory(event.target.value);
    setInventoryPage(1);
  };

  const handleMovementTypeChange = (event) => {
    setMovementType(event.target.value);
    setMovementPage(1);
  };

  const handleDateFromChange = (event) => {
    setDateFrom(event.target.value);
    setMovementPage(1);
  };

  const handleDateToChange = (event) => {
    setDateTo(event.target.value);
    setMovementPage(1);
  };

  const exportInventory = () => {
    downloadCsv(
      "inventory-report.csv",
      [
        "SKU",
        "Product",
        "Category",
        "Unit",
        "Current Stock",
        "Selling Price",
        "Inventory Value",
        "Low Stock Threshold",
      ],
      inventory.map((product) => [
        product.sku,
        product.name,
        product.category,
        product.unit,
        product.currentStock,
        product.sellingPrice,
        product.inventoryValue,
        product.lowStockThreshold,
      ])
    );
  };

  const exportMovements = () => {
    downloadCsv(
      "stock-movements-report.csv",
      [
        "Date",
        "Product SKU",
        "Product",
        "Movement Type",
        "Quantity",
        "Adjustment Direction",
        "Reference",
        "Reason",
        "Performed By",
      ],
      movements.map((movement) => [
        formatDate(movement.createdAt),
        movement.product?.sku,
        movement.product?.name,
        movementLabels[movement.type] || movement.type,
        movement.quantity,
        movement.direction || "",
        movement.reference || "",
        movement.reason,
        movement.performedBy?.name || "",
      ])
    );
  };

  const inventoryTotalPages = inventoryPagination?.totalPages || 1;
  const movementTotalPages = movementPagination?.totalPages || 1;

  if (loadingSummary && !summary) {
    return (
      <div className="reports-loading">
        <div className="reports-spinner" />
        <p>Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <div className="reports-heading">
        <div>
          <h1>Reports & Analytics</h1>
          <p>
            Understand your inventory, stock valuation, and movement history.
          </p>
        </div>

        <button
          className="reports-refresh-button"
          onClick={loadAll}
          disabled={loadingSummary}
        >
          <RefreshCw size={16} />
          Refresh summary
        </button>
      </div>

      {error && (
        <div className="reports-error">
          {error}
        </div>
      )}

      {summary && (
        <>
          <section className="reports-stats">
            <article className="reports-stat">
              <div className="reports-stat-icon blue">
                <Package size={21} />
              </div>
              <div>
                <p>Active Products</p>
                <h2>{formatNumber(summary.totalProducts)}</h2>
              </div>
            </article>

            <article className="reports-stat">
              <div className="reports-stat-icon green">
                <Boxes size={21} />
              </div>
              <div>
                <p>Healthy Products</p>
                <h2>{formatNumber(summary.healthyProducts)}</h2>
              </div>
            </article>

            <article className="reports-stat">
              <div className="reports-stat-icon orange">
                <AlertTriangle size={21} />
              </div>
              <div>
                <p>Low Stock</p>
                <h2>{formatNumber(summary.lowStockProducts)}</h2>
              </div>
            </article>

            <article className="reports-stat">
              <div className="reports-stat-icon red">
                <Package size={21} />
              </div>
              <div>
                <p>Out of Stock</p>
                <h2>{formatNumber(summary.outOfStockProducts)}</h2>
              </div>
            </article>

            <article className="reports-stat valuation-stat">
              <div className="reports-stat-icon purple">
                <CircleDollarSign size={21} />
              </div>
              <div>
                <p>Estimated Inventory Value</p>
                <h2>{formatCurrency(summary.totalInventoryValue)}</h2>
                <span>Based on current selling prices</span>
              </div>
            </article>
          </section>

          <section className="reports-panel">
            <div className="reports-panel-heading">
              <div>
                <h2>Stock by Unit</h2>
                <p>Quantities are grouped by their measurement unit.</p>
              </div>
            </div>

            {Object.keys(summary.stockByUnit || {}).length === 0 ? (
              <p className="reports-empty">No stock data available.</p>
            ) : (
              <div className="unit-summary-grid">
                {Object.entries(summary.stockByUnit).map(([unit, quantity]) => (
                  <div className="unit-summary-item" key={unit}>
                    <span>{unit}</span>
                    <strong>{formatNumber(quantity)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="reports-panel">
            <div className="reports-panel-heading">
              <div>
                <h2>Movement Summary</h2>
                <p>Recorded quantities and number of movements by type.</p>
              </div>
            </div>

            <div className="movement-summary-grid">
              {Object.entries(summary.movements || {}).map(([type, data]) => (
                <div className="movement-summary-item" key={type}>
                  <span>{movementLabels[type] || type}</span>
                  <strong>{formatNumber(data.totalQuantity)}</strong>
                  <small>
                    {formatNumber(data.movementCount)} records
                  </small>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="reports-panel">
        <div className="reports-panel-heading reports-table-heading">
          <div>
            <h2>Inventory Report</h2>
            <p>Current stock and estimated value for active products.</p>
          </div>

          <button
            className="reports-export-button"
            onClick={exportInventory}
            disabled={inventory.length === 0}
          >
            <Download size={16} />
            Export current page
          </button>
        </div>

        <div className="reports-filters">
          <input
            type="search"
            placeholder="Search product or SKU..."
            value={inventorySearch}
            onChange={handleInventorySearch}
          />

          <input
            type="text"
            placeholder="Category (exact)"
            value={inventoryCategory}
            onChange={handleCategoryChange}
          />
        </div>

        <div className="reports-table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Selling Price</th>
                <th>Inventory Value</th>
              </tr>
            </thead>

            <tbody>
              {loadingInventory ? (
                <tr>
                  <td colSpan="5" className="reports-table-message">
                    Loading inventory...
                  </td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan="5" className="reports-table-message">
                    No products found.
                  </td>
                </tr>
              ) : (
                inventory.map((product) => (
                  <tr key={product._id}>
                    <td>
                      <strong>{product.name}</strong>
                      <small>{product.sku}</small>
                    </td>
                    <td>{product.category}</td>
                    <td>
                      {formatNumber(product.currentStock)} {product.unit}
                    </td>
                    <td>{formatCurrency(product.sellingPrice)}</td>
                    <td>{formatCurrency(product.inventoryValue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="reports-pagination">
          <span>
            Page {inventoryPage} of {inventoryTotalPages}
            {" · "}
            {formatNumber(inventoryPagination?.total)} products
          </span>

          <div>
            <button
              disabled={inventoryPage <= 1 || loadingInventory}
              onClick={() => setInventoryPage((page) => page - 1)}
            >
              Previous
            </button>
            <button
              disabled={
                inventoryPage >= inventoryTotalPages || loadingInventory
              }
              onClick={() => setInventoryPage((page) => page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="reports-panel">
        <div className="reports-panel-heading reports-table-heading">
          <div>
            <h2>Stock Movement Report</h2>
            <p>Review recorded purchases, sales, returns, and adjustments.</p>
          </div>

          <button
            className="reports-export-button"
            onClick={exportMovements}
            disabled={movements.length === 0}
          >
            <Download size={16} />
            Export current page
          </button>
        </div>

        <div className="reports-filters movement-filters">
          <select value={movementType} onChange={handleMovementTypeChange}>
            <option value="">All movement types</option>
            <option value="opening">Opening stock</option>
            <option value="purchase">Purchase</option>
            <option value="sale">Sale</option>
            <option value="return">Return</option>
            <option value="adjustment">Adjustment</option>
          </select>

          <label>
            From
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={handleDateFromChange}
            />
          </label>

          <label>
            To
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={handleDateToChange}
            />
          </label>

          <button
            className="reports-clear-button"
            onClick={() => {
              setMovementType("");
              setDateFrom("");
              setDateTo("");
              setMovementPage(1);
            }}
          >
            Clear filters
          </button>
        </div>

        <div className="reports-table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Reference</th>
                <th>Performed By</th>
              </tr>
            </thead>

            <tbody>
              {loadingMovements ? (
                <tr>
                  <td colSpan="6" className="reports-table-message">
                    Loading movements...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan="6" className="reports-table-message">
                    No movements found.
                  </td>
                </tr>
              ) : (
                movements.map((movement) => (
                  <tr key={movement._id}>
                    <td>{formatDate(movement.createdAt)}</td>
                    <td>
                      <strong>{movement.product?.name || "Product unavailable"}</strong>
                      <small>{movement.product?.sku || "—"}</small>
                    </td>
                    <td>
                      <span className={`movement-type-badge ${movement.type}`}>
                        {movementLabels[movement.type] || movement.type}
                      </span>
                    </td>
                    <td>
                      {formatNumber(movement.quantity)}
                      {movement.direction
                        ? ` (${movement.direction})`
                        : ""}
                    </td>
                    <td>{movement.reference || "—"}</td>
                    <td>{movement.performedBy?.name || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="reports-pagination">
          <span>
            Page {movementPage} of {movementTotalPages}
            {" · "}
            {formatNumber(movementPagination?.total)} movements
          </span>

          <div>
            <button
              disabled={movementPage <= 1 || loadingMovements}
              onClick={() => setMovementPage((page) => page - 1)}
            >
              Previous
            </button>
            <button
              disabled={
                movementPage >= movementTotalPages || loadingMovements
              }
              onClick={() => setMovementPage((page) => page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <div className="reports-note">
        <FileBarChart size={17} />
        <p>
          Inventory valuation uses current stock multiplied by selling price.
          Movement quantities are not financial revenue or purchase-cost totals.
          CSV exports contain the currently displayed page.
        </p>
      </div>
    </div>
  );
}
