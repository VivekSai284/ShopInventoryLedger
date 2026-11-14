
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Archive,
  RotateCcw,
  X,
  Package,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import "./Products.css";

const emptyForm = {
  sku: "",
  name: "",
  category: "",
  unit: "",
  sellingPrice: "",
  lowStockThreshold: "5",
};

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);

export default function Products() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [products, setProducts] = useState([]);
  const [stockByProduct, setStockByProduct] = useState({});
  const [categories, setCategories] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Debounce search so we don't send an API request on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setPageError("");
      setActionError("");

      const response = await api.get("/products", {
        params: {
          page,
          limit: 10,
          ...(search ? { search } : {}),
          ...(category ? { category } : {}),
          ...(isOwner && includeArchived
            ? { includeArchived: "true" }
            : {}),
        },
      });

      const data = response.data.data;
      const list = data.products || [];

      setProducts(list);
      setPagination(
        data.pagination || {
          page: 1,
          total: list.length,
          totalPages: 1,
        }
      );

      // Load current stock from the ledger-backed stock endpoint.
      const stockResults = await Promise.allSettled(
        list.map((product) =>
          api.get(`/stock/${product._id}/stock`)
        )
      );

      const nextStock = {};

      stockResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          nextStock[list[index]._id] =
            result.value.data.data.currentStock;
        }
      });

      setStockByProduct((previous) => ({
        ...previous,
        ...nextStock,
      }));
    } catch (err) {
      setPageError(
        err.response?.data?.message ||
          "Unable to load products. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, category, isOwner, includeArchived]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Build category options from the products currently returned by the API.
  // The backend category filter remains the source of truth.
  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      try {
        const response = await api.get("/products", {
          params: { page: 1, limit: 100 },
        });

        if (!cancelled) {
          const names = [
            ...new Set(
              (response.data.data.products || [])
                .map((product) => product.category)
                .filter(Boolean)
            ),
          ].sort((a, b) => a.localeCompare(b));

          setCategories(names);
        }
      } catch {
        // Category filtering remains usable for the categories loaded
        // from the current page if this optional request fails.
      }
    };

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  const openAddForm = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setActionError("");
    setSuccessMessage("");
    setShowForm(true);
  };

  const openEditForm = (product) => {
    setEditingProduct(product);
    setForm({
      sku: product.sku || "",
      name: product.name || "",
      category: product.category || "",
      unit: product.unit || "",
      sellingPrice: String(product.sellingPrice ?? ""),
      lowStockThreshold: String(product.lowStockThreshold ?? 5),
    });
    setActionError("");
    setSuccessMessage("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditingProduct(null);
    setForm(emptyForm);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setActionError("");
    setSuccessMessage("");

    const sellingPrice = Number(form.sellingPrice);
    const lowStockThreshold = Number(form.lowStockThreshold);

    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      setActionError("Enter a valid selling price.");
      return;
    }

    if (
      !Number.isSafeInteger(lowStockThreshold) ||
      lowStockThreshold < 0
    ) {
      setActionError("Low-stock threshold must be a whole number of 0 or more.");
      return;
    }

    const payload = {
      sku: form.sku.trim().toUpperCase(),
      name: form.name.trim(),
      category: form.category.trim(),
      unit: form.unit.trim(),
      sellingPrice,
      lowStockThreshold,
    };

    try {
      setSaving(true);

      if (editingProduct) {
        await api.patch(`/products/${editingProduct._id}`, payload);
        setSuccessMessage("Product updated successfully.");
      } else {
        await api.post("/products", payload);
        setSuccessMessage("Product created successfully.");
      }

      setShowForm(false);
      setEditingProduct(null);
      setForm(emptyForm);
      setPage(1);
      await loadProducts();
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          err.response?.data?.errors?.[0]?.message ||
          "Unable to save product. Please check the details."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (product) => {
    const confirmed = window.confirm(
      `Archive "${product.name}"? It will no longer appear in the active product list.`
    );

    if (!confirmed) return;

    try {
      setActionError("");
      setSuccessMessage("");
      await api.patch(`/products/${product._id}/archive`);
      setSuccessMessage(`${product.name} archived successfully.`);
      await loadProducts();
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Unable to archive this product."
      );
    }
  };

  const handleRestore = async (product) => {
    try {
      setActionError("");
      setSuccessMessage("");
      await api.patch(`/products/${product._id}/restore`);
      setSuccessMessage(`${product.name} restored successfully.`);
      await loadProducts();
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Unable to restore this product."
      );
    }
  };

  const visibleCount = useMemo(
    () => products.length,
    [products]
  );

  return (
    <div className="products-page">
      <div className="page-heading products-heading">
        <div>
          <h1>Products</h1>
          <p>Manage your inventory products and stock information.</p>
        </div>

        {isOwner && (
          <button className="product-primary-button" onClick={openAddForm}>
            <Plus size={18} />
            Add Product
          </button>
        )}
      </div>

      {successMessage && (
        <div className="products-success">
          <span>{successMessage}</span>
          <button
            aria-label="Dismiss success message"
            onClick={() => setSuccessMessage("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {actionError && !showForm && (
        <div className="products-error">
          <span>{actionError}</span>
          <button onClick={() => setActionError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <section className="products-toolbar">
        <div className="products-search">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search by product name or SKU..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>

        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(1);
          }}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </select>

        {isOwner && (
          <label className="archived-toggle">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => {
                setIncludeArchived(event.target.checked);
                setPage(1);
              }}
            />
            Show archived
          </label>
        )}

        <button
          className="products-refresh-button"
          onClick={loadProducts}
          disabled={loading}
          title="Refresh products"
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </section>

      {pageError && (
        <div className="products-error">
          <span>{pageError}</span>
          <button onClick={loadProducts}>Retry</button>
        </div>
      )}

      <section className="products-table-panel">
        <div className="products-table-heading">
          <div>
            <h2>Product List</h2>
            <p>
              Showing {visibleCount} of {pagination.total || 0} products
            </p>
          </div>
        </div>

        {loading ? (
          <div className="products-loading">
            <div className="products-spinner" />
            <p>Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="products-empty">
            <Package size={35} />
            <h3>No products found</h3>
            <p>
              {search || category
                ? "Try changing your search or category filter."
                : "Add your first product to get started."}
            </p>
            {isOwner && !search && !category && (
              <button
                className="product-primary-button"
                onClick={openAddForm}
              >
                <Plus size={17} />
                Add Product
              </button>
            )}
          </div>
        ) : (
          <div className="products-table-wrap">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Selling Price</th>
                  <th>Current Stock</th>
                  <th>Status</th>
                  {isOwner && <th>Actions</th>}
                </tr>
              </thead>

              <tbody>
                {products.map((product) => {
                  const stock = stockByProduct[product._id];
                  const isArchived = product.isArchived;
                  const isOutOfStock = stock === 0;
                  const isLowStock =
                    stock !== undefined &&
                    stock > 0 &&
                    stock <= product.lowStockThreshold;

                  return (
                    <tr key={product._id}>
                      <td>
                        <div className="product-name-cell">
                          <strong>{product.name}</strong>
                          <small>{product.sku}</small>
                        </div>
                      </td>
                      <td>{product.category}</td>
                      <td>{product.unit}</td>
                      <td>{money(product.sellingPrice)}</td>
                      <td>
                        {stock === undefined
                          ? "Unavailable"
                          : `${stock.toLocaleString("en-IN")} ${product.unit}`}
                      </td>
                      <td>
                        {isArchived ? (
                          <span className="product-status archived">
                            Archived
                          </span>
                        ) : isOutOfStock ? (
                          <span className="product-status out">
                            Out of stock
                          </span>
                        ) : isLowStock ? (
                          <span className="product-status low">
                            Low stock
                          </span>
                        ) : stock === undefined ? (
                          <span className="product-status unavailable">
                            Unknown
                          </span>
                        ) : (
                          <span className="product-status active">
                            In stock
                          </span>
                        )}
                      </td>

                      {isOwner && (
                        <td>
                          <div className="product-actions">
                            {!isArchived && (
                              <>
                                <button
                                  className="product-action edit"
                                  title="Edit product"
                                  onClick={() => openEditForm(product)}
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  className="product-action archive"
                                  title="Archive product"
                                  onClick={() => handleArchive(product)}
                                >
                                  <Archive size={16} />
                                </button>
                              </>
                            )}

                            {isArchived && (
                              <button
                                className="product-action restore"
                                title="Restore product"
                                onClick={() => handleRestore(product)}
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && pagination.totalPages > 1 && (
          <div className="products-pagination">
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <div>
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft size={17} />
                Previous
              </button>

              <button
                onClick={() =>
                  setPage((current) =>
                    Math.min(pagination.totalPages, current + 1)
                  )
                }
                disabled={page >= pagination.totalPages}
              >
                Next
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
      </section>

      {showForm && (
        <div className="product-modal-backdrop">
          <section
            className="product-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-form-title"
          >
            <div className="product-modal-heading">
              <div>
                <h2 id="product-form-title">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </h2>
                <p>
                  {editingProduct
                    ? "Update the product details."
                    : "Enter the details for your new inventory product."}
                </p>
              </div>

              <button
                className="product-modal-close"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>

            {actionError && (
              <div className="products-error">{actionError}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="product-form-grid">
                <label>
                  SKU *
                  <input
                    name="sku"
                    value={form.sku}
                    onChange={handleFormChange}
                    minLength={2}
                    maxLength={40}
                    pattern="[A-Za-z0-9][A-Za-z0-9_-]*"
                    title="Use letters, numbers, underscores or hyphens. Start with a letter or number."
                    required
                  />
                </label>

                <label>
                  Product Name *
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    minLength={2}
                    maxLength={150}
                    required
                  />
                </label>

                <label>
                  Category *
                  <input
                    name="category"
                    value={form.category}
                    onChange={handleFormChange}
                    minLength={2}
                    maxLength={80}
                    list="product-category-options"
                    required
                  />
                  <datalist id="product-category-options">
                    {categories.map((item) => (
                      <option value={item} key={item} />
                    ))}
                  </datalist>
                </label>

                <label>
                  Unit *
                  <input
                    name="unit"
                    value={form.unit}
                    onChange={handleFormChange}
                    maxLength={30}
                    placeholder="e.g. pieces, kg, litre"
                    required
                  />
                </label>

                <label>
                  Selling Price (₹) *
                  <input
                    type="number"
                    name="sellingPrice"
                    value={form.sellingPrice}
                    onChange={handleFormChange}
                    min="0"
                    max="100000000"
                    step="0.01"
                    required
                  />
                </label>

                <label>
                  Low-stock Threshold *
                  <input
                    type="number"
                    name="lowStockThreshold"
                    value={form.lowStockThreshold}
                    onChange={handleFormChange}
                    min="0"
                    max="100000000"
                    step="1"
                    required
                  />
                </label>
              </div>

              <div className="product-form-note">
                Initial stock is not entered here. Record opening stock or a
                purchase through Stock Movements so that stock remains
                ledger-based.
              </div>

              <div className="product-form-actions">
                <button
                  type="button"
                  className="product-cancel-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="product-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingProduct
                      ? "Save Changes"
                      : "Create Product"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
