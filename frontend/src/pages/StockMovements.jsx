import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardList,
  Filter,
  History,
  Package,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Wrench,
} from "lucide-react";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import "./StockMovements.css";
import { useLocation } from "react-router-dom";

const PAGE_SIZE = 10;

const MOVEMENT_LABELS = {
  opening: "Opening Stock",
  purchase: "Purchase",
  sale: "Sale",
  return: "Return",
  adjustment: "Adjustment",
};

const MOVEMENT_ICONS = {
  opening: Package,
  purchase: ArrowDownCircle,
  sale: ShoppingCart,
  return: RotateCcw,
  adjustment: Wrench,
};

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function getErrorMessage(error) {
  return (
    error.response?.data?.message ||
    error.response?.data?.errors?.[0]?.message ||
    error.message ||
    "Something went wrong. Please try again."
  );
}

export default function StockMovements() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const location = useLocation();

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productSearch, setProductSearch] = useState("");

  const [selectedProductId, setSelectedProductId] = useState("");

  const [stock, setStock] = useState(null);
  const [stockLoading, setStockLoading] = useState(false);

  const [movements, setMovements] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPagination, setHistoryPagination] = useState(null);
  const [historyType, setHistoryType] = useState("");

  const [movementType, setMovementType] = useState("sale");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [adjustmentDirection, setAdjustmentDirection] = useState("in");
  const [returnableSales, setReturnableSales] = useState([]);
  const [returnableSalesLoading, setReturnableSalesLoading] = useState(false);
  const [originalSaleId, setOriginalSaleId] = useState("");
  const [returnSalesRefreshKey, setReturnSalesRefreshKey] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedProduct = useMemo(
    () => products.find((product) => product._id === selectedProductId),
    [products, selectedProductId],
  );

  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();

    if (!search) return products;

    return products.filter((product) =>
      `${product.name} ${product.sku} ${product.category || ""}`
        .toLowerCase()
        .includes(search),
    );
  }, [products, productSearch]);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setPageError("");

    try {
      // Load the first page.
      const firstResponse = await api.get("/products", {
        params: { page: 1, limit: 100 },
      });

      const firstData = firstResponse.data?.data || {};
      let list = firstData.products || [];

      // Load remaining pages if there are more than 100 products.
      const totalPages = Number(firstData.pagination?.totalPages || 1);

      if (totalPages > 1) {
        const remainingPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            api.get("/products", {
              params: { page: index + 2, limit: 100 },
            }),
          ),
        );

        remainingPages.forEach((response) => {
          list = [...list, ...(response.data?.data?.products || [])];
        });
      }

      setProducts(list);

      // Apply the product selected from the Low Stock page.
      const requestedProductId = location.state?.productId;
      const requestedMovementType = location.state?.movementType;

      const requestedProduct = list.find(
        (product) => product._id === requestedProductId,
      );

      if (requestedProduct) {
        setSelectedProductId(requestedProduct._id);

        if (requestedMovementType === "purchase" && isOwner) {
          setMovementType("purchase");
        } else if (requestedMovementType === "return") {
          setMovementType("return");
        } else {
          setMovementType("sale");
        }
      } else {
        // Normal page opening: select the first available product.
        setSelectedProductId(list[0]?._id || "");
      }
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setProductsLoading(false);
    }
  }, [location.state, isOwner]);

  const loadStock = useCallback(async (productId) => {
    if (!productId) {
      setStock(null);
      return;
    }

    setStockLoading(true);

    try {
      const response = await api.get(`/stock/${productId}/stock`);
      setStock(response.data?.data || null);
    } catch (error) {
      setStock(null);
      setPageError(getErrorMessage(error));
    } finally {
      setStockLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (productId, page = 1, type = "") => {
    if (!productId) {
      setMovements([]);
      setHistoryPagination(null);
      return;
    }

    setHistoryLoading(true);

    try {
      const response = await api.get(`/stock/${productId}/history`, {
        params: {
          page,
          limit: PAGE_SIZE,
          ...(type ? { type } : {}),
        },
      });

      const data = response.data?.data || {};

      setMovements(data.movements || []);
      setHistoryPagination(data.pagination || null);
    } catch (error) {
      setMovements([]);
      setHistoryPagination(null);
      setPageError(getErrorMessage(error));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (!selectedProductId) {
      setStock(null);
      setMovements([]);
      setHistoryPagination(null);
      return;
    }

    loadStock(selectedProductId);
    loadHistory(selectedProductId, historyPage, historyType);
  }, [selectedProductId, historyPage, historyType, loadStock, loadHistory]);

  useEffect(() => {
    if (movementType !== "return" || !selectedProductId) {
      setReturnableSales([]);
      setOriginalSaleId("");
      setReturnableSalesLoading(false);
      return;
    }

    let cancelled = false;

    const fetchReturnableSales = async () => {
      setReturnableSalesLoading(true);
      setReturnableSales([]);
      setOriginalSaleId("");

      try {
        const response = await api.get(
          `/stock/${selectedProductId}/returnable-sales`,
        );

        if (cancelled) return;

        const sales = response.data?.data?.sales || [];

        setReturnableSales(sales);

        setOriginalSaleId(sales[0]?._id || "");
      } catch (error) {
        if (!cancelled) {
          setPageError(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setReturnableSalesLoading(false);
        }
      }
    };

    fetchReturnableSales();

    return () => {
      cancelled = true;
    };
  }, [movementType, selectedProductId, returnSalesRefreshKey]);

  useEffect(() => {
    setHistoryPage(1);
  }, [selectedProductId, historyType]);

  const refreshSelectedProduct = async () => {
    await Promise.all([
      loadStock(selectedProductId),
      loadHistory(selectedProductId, historyPage, historyType),
    ]);
  };

  const handleMovementTypeChange = (type) => {
    setMovementType(type);
    setSuccessMessage("");
    setPageError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setPageError("");
    setSuccessMessage("");

    if (!selectedProductId) {
      setPageError("Please select a product.");
      return;
    }

    const parsedQuantity = Number(quantity);

    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      setPageError("Quantity must be a positive whole number.");
      return;
    }

    if (!reason.trim()) {
      setPageError("Please enter a reason for this movement.");
      return;
    }

    if (movementType === "return" && !originalSaleId) {
      setPageError("Please select the original sale for this return.");
      return;
    }

    const payload = {
      productId: selectedProductId,
      quantity: parsedQuantity,
      reason: reason.trim(),
      ...(reference.trim() ? { reference: reference.trim() } : {}),
      ...(movementType === "return" ? { originalSaleId } : {}),
    };

    let endpoint = "";

    switch (movementType) {
      case "purchase":
        endpoint = "/stock/purchases";
        break;
      case "sale":
        endpoint = "/stock/sales";
        break;
      case "return":
        endpoint = "/stock/returns";
        break;
      case "adjustment":
        endpoint = "/stock/adjustments";
        payload.direction = adjustmentDirection;
        break;
      default:
        setPageError("Please select a valid movement type.");
        return;
    }

    setSubmitting(true);

    try {
      const response = await api.post(endpoint, payload);

      const stockAfter = response.data?.data?.stockAfter;

      setSuccessMessage(
        `${MOVEMENT_LABELS[movementType]} recorded successfully.${
          Number.isFinite(stockAfter)
            ? ` Current stock: ${stockAfter} ${selectedProduct?.unit || ""}.`
            : ""
        }`,
      );

      setQuantity("");
      setReason("");
      setReference("");

      await refreshSelectedProduct();
      if (movementType === "return") {
        setReturnSalesRefreshKey((key) => key + 1);
      }
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const getMovementQuantity = (movement) => {
    if (Number.isFinite(movement.quantityDelta)) {
      return movement.quantityDelta;
    }

    if (movement.type === "sale") return -movement.quantity;

    if (movement.type === "adjustment" && movement.direction === "out") {
      return -movement.quantity;
    }

    return movement.quantity;
  };

  const getMovementUser = (movement) => {
    const performer = movement.performedBy;

    if (!performer) return "—";

    if (typeof performer === "string") return performer;

    return performer.name || performer.email || "User";
  };

  const historyTotalPages =
    historyPagination?.totalPages ||
    (historyPagination?.total
      ? Math.ceil(historyPagination.total / PAGE_SIZE)
      : 1);

  const canRecord = isOwner || ["sale", "return"].includes(movementType);

  return (
    <div className="movements-page">
      <div className="movements-header">
        <div>
          <span className="page-eyebrow">INVENTORY MANAGEMENT</span>
          <h1>Stock Movements</h1>
          <p>Record stock changes and track the complete product ledger.</p>
        </div>

        <button
          type="button"
          className="movement-refresh-button"
          onClick={refreshSelectedProduct}
          disabled={!selectedProductId || stockLoading || historyLoading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {pageError && (
        <div className="movement-alert movement-alert-error" role="alert">
          {pageError}
          <button type="button" onClick={() => setPageError("")}>
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="movement-alert movement-alert-success" role="status">
          {successMessage}
          <button type="button" onClick={() => setSuccessMessage("")}>
            ×
          </button>
        </div>
      )}

      <section className="movement-product-panel">
        <div className="movement-section-heading">
          <div>
            <h2>Select Product</h2>
            <p>Choose a product to record a movement or view its history.</p>
          </div>
          <Package size={22} />
        </div>

        <div className="movement-product-controls">
          <div className="movement-search">
            <Search size={17} />
            <input
              type="text"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Search by product name or SKU..."
            />
          </div>

          <select
            value={selectedProductId}
            onChange={(event) => {
              setSelectedProductId(event.target.value);
              setHistoryPage(1);
              setSuccessMessage("");
              setPageError("");
            }}
            disabled={productsLoading}
          >
            <option value="">
              {productsLoading ? "Loading products..." : "Select a product"}
            </option>
            {filteredProducts.map((product) => (
              <option key={product._id} value={product._id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </select>
        </div>

        {!productsLoading && products.length === 0 && (
          <p className="movement-empty-message">
            No active products found. Add a product first.
          </p>
        )}

        {!productsLoading &&
          products.length > 0 &&
          filteredProducts.length === 0 && (
            <p className="movement-empty-message">
              No products match your search.
            </p>
          )}
      </section>

      {selectedProduct && (
        <>
          <section className="movement-stock-summary">
            <div className="movement-stock-product">
              <span className="movement-summary-label">SELECTED PRODUCT</span>
              <h2>{selectedProduct.name}</h2>
              <p>
                SKU: {selectedProduct.sku} · {selectedProduct.category}
              </p>
            </div>

            <div className="movement-stock-value">
              <span className="movement-summary-label">CURRENT STOCK</span>
              <strong>
                {stockLoading ? "..." : (stock?.currentStock ?? "—")}
              </strong>
              <span>{stock?.unit || selectedProduct.unit}</span>
            </div>

            <div className="movement-stock-price">
              <span className="movement-summary-label">SELLING PRICE</span>
              <strong>
                {Number(selectedProduct.sellingPrice || 0).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 2 },
                )}
              </strong>
            </div>
          </section>

          <section className="movement-form-panel">
            <div className="movement-section-heading">
              <div>
                <h2>Record a Movement</h2>
                <p>
                  Every submitted movement becomes a permanent ledger entry.
                </p>
              </div>
              <ClipboardList size={22} />
            </div>

            <div className="movement-type-tabs">
              {[
                ...(isOwner ? ["purchase"] : []),
                "sale",
                "return",
                ...(isOwner ? ["adjustment"] : []),
              ].map((type) => {
                const Icon = MOVEMENT_ICONS[type];

                return (
                  <button
                    key={type}
                    type="button"
                    className={
                      movementType === type
                        ? "movement-tab active"
                        : "movement-tab"
                    }
                    onClick={() => handleMovementTypeChange(type)}
                  >
                    <Icon size={17} />
                    {MOVEMENT_LABELS[type]}
                  </button>
                );
              })}
            </div>

            <form className="movement-form" onSubmit={handleSubmit}>
              {movementType === "adjustment" && (
                <div className="movement-field movement-direction-field">
                  <label>Adjustment Direction</label>
                  <div className="movement-direction-options">
                    <button
                      type="button"
                      className={adjustmentDirection === "in" ? "selected" : ""}
                      onClick={() => setAdjustmentDirection("in")}
                    >
                      <TrendingUp size={16} />
                      Stock In
                    </button>
                    <button
                      type="button"
                      className={
                        adjustmentDirection === "out" ? "selected" : ""
                      }
                      onClick={() => setAdjustmentDirection("out")}
                    >
                      <TrendingDown size={16} />
                      Stock Out
                    </button>
                  </div>
                </div>
              )}

              <div className="movement-form-grid">
                {movementType === "return" && (
                  <div className="movement-field movement-original-sale-field">
                    <label htmlFor="movement-original-sale">
                      Original Sale *
                    </label>

                    <select
                      id="movement-original-sale"
                      value={originalSaleId}
                      onChange={(event) =>
                        setOriginalSaleId(event.target.value)
                      }
                      disabled={
                        returnableSalesLoading || returnableSales.length === 0
                      }
                      required
                    >
                      <option value="">
                        {returnableSalesLoading
                          ? "Loading eligible sales..."
                          : "Select original sale"}
                      </option>

                      {returnableSales.map((sale) => (
                        <option key={sale._id} value={sale._id}>
                          {formatDate(sale.createdAt)}
                          {" · Sold: "}
                          {sale.quantity}
                          {" · Returned: "}
                          {sale.returnedQuantity}
                          {" · Remaining: "}
                          {sale.remainingReturnable}
                          {sale.reference ? ` · Ref: ${sale.reference}` : ""}
                        </option>
                      ))}
                    </select>

                    {returnableSalesLoading ? (
                      <small>Loading returnable sales...</small>
                    ) : returnableSales.length === 0 ? (
                      <small>No eligible sales found for this product.</small>
                    ) : (
                      <small>
                        Select the sale against which this return is being
                        recorded.
                      </small>
                    )}
                  </div>
                )}
                <div className="movement-field">
                  <label htmlFor="movement-quantity">Quantity *</label>
                  <input
                    id="movement-quantity"
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder="Enter quantity"
                    required
                  />
                  <small>Unit: {selectedProduct.unit}</small>
                </div>

                <div className="movement-field">
                  <label htmlFor="movement-reference">
                    Reference (optional)
                  </label>
                  <input
                    id="movement-reference"
                    type="text"
                    maxLength="100"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="Invoice / order reference"
                  />
                </div>

                <div className="movement-field movement-reason-field">
                  <label htmlFor="movement-reason">Reason *</label>
                  <textarea
                    id="movement-reason"
                    rows="3"
                    maxLength="500"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Explain why this stock movement is being recorded..."
                    required
                  />
                </div>
              </div>

              <div className="movement-form-footer">
                <p>
                  {movementType === "sale"
                    ? "A sale decreases available stock."
                    : movementType === "return"
                      ? "A return adds stock back to inventory."
                      : movementType === "purchase"
                        ? "A purchase adds stock to inventory."
                        : `This adjustment will move stock ${
                            adjustmentDirection === "in" ? "into" : "out of"
                          } inventory.`}
                </p>

                <button
                  type="submit"
                  className="movement-submit-button"
                  disabled={
                    submitting ||
                    !canRecord ||
                    !selectedProductId ||
                    (movementType === "return" &&
                      (!originalSaleId || returnableSalesLoading))
                  }
                >
                  {submitting ? "Recording..." : "Record Movement"}
                </button>
              </div>
            </form>
          </section>

          <section className="movement-history-panel">
            <div className="movement-section-heading movement-history-heading">
              <div>
                <h2>
                  <History size={20} />
                  Stock History
                </h2>
                <p>All recorded movements for {selectedProduct.name}.</p>
              </div>

              <div className="movement-history-filter">
                <Filter size={16} />
                <select
                  value={historyType}
                  onChange={(event) => setHistoryType(event.target.value)}
                >
                  <option value="">All movements</option>
                  <option value="opening">Opening</option>
                  <option value="purchase">Purchase</option>
                  <option value="sale">Sale</option>
                  <option value="return">Return</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
            </div>

            <div className="movement-table-wrapper">
              <table className="movement-table">
                <thead>
                  <tr>
                    <th>Movement</th>
                    <th>Quantity</th>
                    <th>Reason</th>
                    <th>Reference</th>
                    <th>Recorded By</th>
                    <th>Date</th>
                  </tr>
                </thead>

                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan="6" className="movement-table-message">
                        Loading stock history...
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="movement-table-message">
                        No stock movements found.
                      </td>
                    </tr>
                  ) : (
                    movements.map((movement) => {
                      const quantityDelta = getMovementQuantity(movement);
                      const isIncoming = quantityDelta >= 0;

                      return (
                        <tr key={movement._id}>
                          <td>
                            <span
                              className={`movement-type-badge movement-${movement.type}`}
                            >
                              {MOVEMENT_LABELS[movement.type] || movement.type}
                            </span>
                          </td>
                          <td>
                            <strong
                              className={
                                isIncoming
                                  ? "movement-quantity-in"
                                  : "movement-quantity-out"
                              }
                            >
                              {isIncoming ? "+" : ""}
                              {quantityDelta} {selectedProduct.unit}
                            </strong>
                          </td>
                          <td className="movement-reason-cell">
                            {movement.reason || "—"}
                          </td>
                          <td>{movement.reference || "—"}</td>
                          <td>{getMovementUser(movement)}</td>
                          <td>{formatDate(movement.createdAt)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="movement-pagination">
              <span>
                Page {historyPage} of {Math.max(historyTotalPages, 1)}
                {historyPagination?.total != null
                  ? ` · ${historyPagination.total} records`
                  : ""}
              </span>

              <div>
                <button
                  type="button"
                  onClick={() =>
                    setHistoryPage((page) => Math.max(1, page - 1))
                  }
                  disabled={historyPage <= 1 || historyLoading}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setHistoryPage((page) =>
                      Math.min(historyTotalPages, page + 1),
                    )
                  }
                  disabled={historyPage >= historyTotalPages || historyLoading}
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
