import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toast } from "sonner";

import type { UserProfile } from "@/types";

import type {
  AdminBikeSaleShopRow,
  BikeSaleDirectoryStatus,
  SaleShop,
  SaleShopStatus,
} from "@/types/saleShop";

import { useAuth } from "@/hooks/useAuth";

import { useAdminHeaderSearch } from "@/hooks/useAdminHeaderSearch";

import { loadAdminBikeSaleShopsFromFirestore } from "@/services/adminSaleShops";

import { isFirebaseConfigured } from "@/services/firebase";

import { adminProvisionBikeSaleShopOwner } from "@/services/auth";

import {
  createSaleShopAtOwnerUid,
  getSaleShopById,
  updateSaleShop,
} from "@/services/saleShops";

import {
  adminDeleteUserDocument,
  getUserProfileByIdForAdmin,
  updateOwnerShopProfile,
  updateOwnerStatus,
} from "@/services/users";

import { rowMatchesAdminQuery } from "@/utils/adminSearch";

import {
  getErrorCode,
  mapFirebaseAuthError,
  mapServiceError,
} from "@/utils/firebaseErrors";

import { SRI_LANKA_DISTRICTS } from "@/utils/sriLankaDistricts";

import "@/styles/admin-sale-shops.css";

type SortKey = "newest" | "name" | "listings";

type EditModalState =
  | null
  | {
      mode: "directory";
      row: AdminBikeSaleShopRow;
      doc: SaleShop | null;
      loading: boolean;
    }
  | {
      mode: "profile";
      row: AdminBikeSaleShopRow;
      profile: UserProfile | null;
      loading: boolean;
    };

function directoryLabel(s: BikeSaleDirectoryStatus) {
  if (s === "verified") return "✓ Verified";

  if (s === "pending") return "⏳ Pending Review";

  return "📭 No directory row";
}

function computeStats(list: AdminBikeSaleShopRow[]) {
  const total = list.length;

  const verified = list.filter((x) => x.directoryStatus === "verified").length;

  const pending = list.filter((x) => x.directoryStatus === "pending").length;

  const unlisted = list.filter((x) => x.directoryStatus === "none").length;

  const listings = list.reduce((a, r) => a + r.listings, 0);

  const verifiedPct = total > 0 ? Math.round((verified / total) * 100) : 0;

  return { total, verified, pending, unlisted, listings, verifiedPct };
}

function saleShopSearchParts(s: AdminBikeSaleShopRow) {
  return [
    s.name,

    s.email,

    s.city,

    s.district,

    s.owner,

    s.phone,

    String(s.id),

    s.ownerUid,

    s.address,
  ] as const;
}

export function AdminSaleShopsPage() {
  const { firebaseUser } = useAuth();

  const adminUid = firebaseUser?.uid ?? "";

  const adminHeaderSearch = useAdminHeaderSearch();

  const [shops, setShops] = useState<AdminBikeSaleShopRow[]>([]);

  const [loading, setLoading] = useState(true);

  /** Re-fetch without blanking the grid (manual Refresh + after saves). */
  const [refreshing, setRefreshing] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [shopMutating, setShopMutating] = useState(false);

  const [topQuery, setTopQuery] = useState("");

  const [filterSearch, setFilterSearch] = useState("");

  const [district, setDistrict] = useState("all");

  const [status, setStatus] = useState("all");

  const [sort, setSort] = useState<SortKey>("newest");

  const [modalOpen, setModalOpen] = useState(false);

  const [viewRow, setViewRow] = useState<AdminBikeSaleShopRow | null>(null);

  const [editModal, setEditModal] = useState<EditModalState>(null);

  const [deletingUid, setDeletingUid] = useState<string | null>(null);

  const [notifyOpen, setNotifyOpen] = useState(false);

  const notifyWrapRef = useRef<HTMLDivElement>(null);

  const [approvingUid, setApprovingUid] = useState<string | null>(null);

  const stats = useMemo(() => computeStats(shops), [shops]);

  const pendingShops = useMemo(
    () => shops.filter((s) => s.ownerStatus === "pending"),
    [shops],
  );

  const pendingInboxCount = pendingShops.length;

  const reload = useCallback(async (options?: { notify?: boolean; soft?: boolean }) => {
    if (!isFirebaseConfigured) {
      setLoadError("Firebase is not configured.");

      setShops([]);

      setLoading(false);

      setRefreshing(false);

      if (options?.notify) {
        toast.error("Firebase is not configured.");
      }

      return;
    }

    const soft = Boolean(options?.soft) || Boolean(options?.notify);

    if (soft) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setLoadError(null);

    try {
      const rows = await loadAdminBikeSaleShopsFromFirestore();

      setShops(rows);

      if (options?.notify) {
        toast.success("Refreshed");
      }
    } catch (e) {
      console.error(e);

      setLoadError("Could not load bike sale data from Firestore.");

      toast.error("Could not load bike sale shops.");

      if (!soft) {
        setShops([]);
      }
    } finally {
      setLoading(false);

      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!notifyOpen) return;

    function onDocMouseDown(e: MouseEvent) {
      if (
        notifyWrapRef.current &&
        !notifyWrapRef.current.contains(e.target as Node)
      ) {
        setNotifyOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setNotifyOpen(false);
    }

    document.addEventListener("mousedown", onDocMouseDown);

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);

      document.removeEventListener("keydown", onKeyDown);
    };
  }, [notifyOpen]);

  const filtered = useMemo(() => {
    let list = [...shops];

    const parts = (s: AdminBikeSaleShopRow) => saleShopSearchParts(s);

    list = list.filter(
      (s) =>
        rowMatchesAdminQuery(parts(s), adminHeaderSearch) &&
        rowMatchesAdminQuery(parts(s), topQuery),
    );

    const fq = filterSearch.trim().toLowerCase();

    if (fq) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(fq) ||
          s.address.toLowerCase().includes(fq),
      );
    }

    if (district !== "all") list = list.filter((s) => s.district === district);

    if (status !== "all") {
      if (status === "owner-pending") {
        list = list.filter((s) => s.ownerStatus === "pending");
      } else {
        list = list.filter(
          (s) => s.directoryStatus === (status as BikeSaleDirectoryStatus),
        );
      }
    }

    const sorted = [...list];

    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "listings")
      sorted.sort((a, b) => b.listings - a.listings);
    else
      sorted.sort(
        (a, b) =>
          (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0) ||
          b.id.localeCompare(a.id),
      );

    return sorted;
  }, [
    shops,
    adminHeaderSearch,
    topQuery,
    filterSearch,
    district,
    status,
    sort,
  ]);

  const openModal = useCallback(() => setModalOpen(true), []);

  const closeModal = useCallback(() => setModalOpen(false), []);

  const applyFilters = useCallback(() => {
    toast.success("Filters applied");
  }, []);

  const exportCsv = useCallback(() => {
    const h =
      "id,ownerUid,name,email,district,city,listings,rating,directoryStatus";

    const lines = filtered.map(
      (s) =>
        `${s.id},${s.ownerUid},"${s.name.replace(/"/g, '""')}",${s.email},${s.district},${s.city},${s.listings},${s.rating},${s.directoryStatus}`,
    );

    const blob = new Blob([[h, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });

    const a = document.createElement("a");

    a.href = URL.createObjectURL(blob);

    a.download = "bike-sale-shops.csv";

    a.click();

    URL.revokeObjectURL(a.href);

    toast.success("Export started");
  }, [filtered]);

  const addShop = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!isFirebaseConfigured) {
        toast.error("Firebase is not configured.");

        return;
      }

      const form = e.currentTarget;

      const fd = new FormData(form);

      const name = String(fd.get("shopName") ?? "").trim();

      const rating = parseFloat(String(fd.get("rating") ?? "4.5"));

      const st = String(fd.get("status") ?? "pending") as SaleShopStatus;

      const statusVal: SaleShopStatus =
        st === "verified" ? "verified" : "pending";

      const owner = String(fd.get("ownerName") ?? "");

      const phone = String(fd.get("phone") ?? "");

      const email = String(fd.get("email") ?? "").trim();

      const password = String(fd.get("password") ?? "");

      const confirmPassword = String(fd.get("confirmPassword") ?? "");

      const districtVal = String(fd.get("district") ?? "");

      const city = String(fd.get("city") ?? "");

      const address = String(fd.get("address") ?? "");

      const listings = Math.max(
        0,
        parseInt(String(fd.get("listings") ?? "0"), 10) || 0,
      );

      const establishedRaw = String(fd.get("established") ?? "").trim();

      const established = establishedRaw || "—";

      const description = String(fd.get("description") ?? "").trim();

      if (!name || !owner || !phone || !email || !districtVal || !address) {
        toast.error("Fill in all required fields.");

        return;
      }

      if (password.length < 6) {
        toast.error("Password must be at least 6 characters.");

        return;
      }

      if (password !== confirmPassword) {
        toast.error("Passwords do not match.");

        return;
      }

      setShopMutating(true);

      try {
        const { uid } = await adminProvisionBikeSaleShopOwner({
          email,
          password,
          ownerName: owner,
          phone,
          shopName: name,
          shopAddress: address,
          district: districtVal,
          city: city || undefined,
        });

        await createSaleShopAtOwnerUid(uid, {
          name,
          owner,
          phone,
          email,
          district: districtVal,
          city,
          address,
          listings,
          rating: Number.isFinite(rating) ? rating : 4.5,
          status: statusVal,
          established,
          description: description || undefined,
          ownerId: uid,
        });

        form.reset();

        closeModal();

        toast.success(
          "Bike sale owner account created — pending approval like self-registrations.",
        );

        await reload({ soft: true });
      } catch (err) {
        const code = getErrorCode(err);

        const msg = code?.startsWith("auth/")
          ? mapFirebaseAuthError(code)
          : mapServiceError(code);

        toast.error(msg);
      } finally {
        setShopMutating(false);
      }
    },

    [closeModal, reload],
  );

  const approveOwner = useCallback(
    async (uid: string, name: string) => {
      if (!isFirebaseConfigured) return;

      setApprovingUid(uid);

      try {
        await updateOwnerStatus(uid, "approved");

        toast.success(`${name} approved`);

        await reload({ soft: true });
      } catch (err) {
        console.error(err);

        toast.error("Could not approve owner.");
      } finally {
        setApprovingUid(null);
      }
    },

    [reload],
  );

  const deleteOwnerUser = useCallback(
    async (ownerUid: string, displayName: string) => {
      if (!isFirebaseConfigured) return;

      if (!ownerUid.trim()) {
        toast.message("No owner account (uid) is linked to this row.");

        return;
      }

      if (ownerUid === adminUid) {
        toast.error("You cannot delete your own account.");

        return;
      }

      if (
        !window.confirm(
          `Delete Firestore profile for “${displayName}”?\n\nUID: ${ownerUid}\n\nThis removes the users document only. Remove the Firebase Auth user separately in the console if needed.`,
        )
      ) {
        return;
      }

      setDeletingUid(ownerUid);

      try {
        await adminDeleteUserDocument(ownerUid);

        toast.success(`Removed ${displayName} from users.`);

        await reload({ soft: true });
      } catch (err) {
        console.error(err);

        toast.error("Could not delete user document.");
      } finally {
        setDeletingUid(null);
      }
    },

    [adminUid, reload],
  );

  const openEdit = useCallback(async (row: AdminBikeSaleShopRow) => {
    if (row.directoryDocId) {
      setEditModal({ mode: "directory", row, doc: null, loading: true });

      try {
        const d = await getSaleShopById(row.directoryDocId);

        setEditModal((prev) =>
          prev && prev.row.id === row.id && prev.mode === "directory"
            ? { ...prev, doc: d, loading: false }
            : prev,
        );
      } catch {
        toast.error("Could not load directory document.");

        setEditModal((prev) =>
          prev && prev.row.id === row.id && prev.mode === "directory"
            ? { ...prev, doc: null, loading: false }
            : prev,
        );
      }
    } else if (row.ownerUid) {
      setEditModal({ mode: "profile", row, profile: null, loading: true });

      try {
        const p = await getUserProfileByIdForAdmin(row.ownerUid);

        setEditModal((prev) =>
          prev && prev.row.id === row.id && prev.mode === "profile"
            ? { ...prev, profile: p, loading: false }
            : prev,
        );
      } catch {
        toast.error("Could not load owner profile.");

        setEditModal((prev) =>
          prev && prev.row.id === row.id && prev.mode === "profile"
            ? { ...prev, profile: null, loading: false }
            : prev,
        );
      }
    } else {
      toast.message(
        "Nothing to edit — this entry has no directory document and no owner uid.",
      );
    }
  }, []);

  const closeEdit = useCallback(() => setEditModal(null), []);

  const submitDirectoryEdit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!editModal || editModal.mode !== "directory" || !editModal.row.directoryDocId)
        return;

      const form = e.currentTarget;

      const fd = new FormData(form);

      const name = String(fd.get("shopName") ?? "").trim();

      const rating = parseFloat(String(fd.get("rating") ?? "4.5"));

      const st = String(fd.get("status") ?? "pending") as SaleShopStatus;

      const statusVal: SaleShopStatus = st === "verified" ? "verified" : "pending";

      const owner = String(fd.get("ownerName") ?? "");

      const phone = String(fd.get("phone") ?? "");

      const email = String(fd.get("email") ?? "");

      const districtVal = String(fd.get("district") ?? "");

      const city = String(fd.get("city") ?? "");

      const address = String(fd.get("address") ?? "");

      const listings = Math.max(
        0,
        parseInt(String(fd.get("listings") ?? "0"), 10) || 0,
      );

      const establishedRaw = String(fd.get("established") ?? "").trim();

      const established = establishedRaw || "—";

      const description = String(fd.get("description") ?? "").trim();

      const ownerUid = String(fd.get("ownerUid") ?? "").trim();

      setShopMutating(true);

      try {
        await updateSaleShop(editModal.row.directoryDocId, {
          name,
          owner,
          phone,
          email,
          district: districtVal,
          city,
          address,
          listings,
          rating: Number.isFinite(rating) ? rating : 4.5,
          status: statusVal,
          established,
          description: description || undefined,
          ownerId: ownerUid || undefined,
        });

        toast.success("Directory entry updated");

        setEditModal(null);

        await reload({ soft: true });
      } catch (err) {
        toast.error(mapServiceError(getErrorCode(err)));
      } finally {
        setShopMutating(false);
      }
    },

    [editModal, reload],
  );

  const submitProfileEdit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!editModal || editModal.mode !== "profile" || !editModal.row.ownerUid) return;

      const form = e.currentTarget;

      const fd = new FormData(form);

      setShopMutating(true);

      try {
        await updateOwnerShopProfile(editModal.row.ownerUid, {
          shopName: String(fd.get("shopName") ?? "").trim(),

          displayName: String(fd.get("displayName") ?? "").trim(),

          phone: String(fd.get("phone") ?? ""),

          whatsapp: String(fd.get("whatsapp") ?? ""),

          shopAddress: String(fd.get("shopAddress") ?? ""),

          location: String(fd.get("location") ?? ""),

          district: String(fd.get("district") ?? ""),
        });

        toast.success("Owner profile updated");

        setEditModal(null);

        await reload({ soft: true });
      } catch (err) {
        toast.error(mapServiceError(getErrorCode(err)));
      } finally {
        setShopMutating(false);
      }
    },

    [editModal, reload],
  );

  return (
    <div className="bb-sale-shops">
      <header className="sl-header">
        <div className="sl-header-left">
          <h1 className="sl-header-title">Sale shops</h1>

          <div className="sl-search">
            <span className="sl-search-ico" aria-hidden>
              🔍
            </span>

            <input
              type="search"
              placeholder="Search shops, bikes, locations…"
              value={topQuery}
              onChange={(e) => setTopQuery(e.target.value)}
              aria-label="Search shops"
            />
          </div>
        </div>

        <div className="sl-header-right">
          <button
            type="button"
            className={`ss-quick-add${refreshing ? " ss-quick-add--refreshing" : ""}`}
            onClick={() => void reload({ notify: true })}
            disabled={loading || refreshing}
            aria-busy={refreshing}
            aria-label={refreshing ? "Refreshing sale shops" : "Refresh sale shops list"}
          >
            <span className={refreshing ? "ss-refresh-icon" : undefined} aria-hidden>
              ↻
            </span>
            <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
          </button>

          <button type="button" className="ss-quick-add" onClick={openModal}>
            <span>➕</span>
            <span>Add Shop</span>
          </button>

          <div className="ss-notify-wrap" ref={notifyWrapRef}>
            <button
              type="button"
              className="ss-notify"
              aria-label="Pending shop approvals"
              aria-expanded={notifyOpen}
              aria-haspopup="dialog"
              aria-controls="sl-notify-panel"
              onClick={() => setNotifyOpen((o) => !o)}
            >
              🔔
              <span className="ss-notify-badge" aria-hidden>
                {pendingInboxCount > 99 ? "99+" : pendingInboxCount}
              </span>
            </button>
            {notifyOpen ? (
              <div
                id="sl-notify-panel"
                className="ss-notify-panel"
                role="dialog"
                aria-label="Pending approvals"
              >
                <div className="ss-notify-panel-head">
                  <span className="ss-notify-panel-title">Pending approvals</span>
                  <button
                    type="button"
                    className="ss-notify-panel-close"
                    onClick={() => setNotifyOpen(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                {pendingShops.length === 0 ? (
                  <p className="ss-notify-empty">
                    No shops waiting for approval.
                  </p>
                ) : (
                  <ul className="ss-notify-list">
                    {pendingShops.map((s) => (
                      <li key={s.id} className="ss-notify-item">
                        <div className="ss-notify-item-main">
                          <div className="ss-notify-item-name">{s.name}</div>
                          <div className="ss-notify-item-meta">
                            {s.owner} · {s.email}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="sl-btn sl-btn-pri ss-notify-approve"
                          disabled={approvingUid === s.id}
                          onClick={() => {
                            void approveOwner(s.id, s.name);
                            setNotifyOpen(false);
                          }}
                        >
                          {approvingUid === s.id ? "…" : "Approve"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="ss-notify-panel-foot">
                  <button
                    type="button"
                    className="sl-btn sl-btn-sec ss-notify-foot-btn"
                    onClick={() => {
                      setStatus("owner-pending");
                      setNotifyOpen(false);
                      document
                        .getElementById("sl-all-shops")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    Show pending in list
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="sl-hero">
        <div className="sl-hero-in">
          <h2 className="sl-hero-title">
            <span className="sl-hero-title-ic" aria-hidden>
              🏪
            </span>
            Bike Sale Shops
          </h2>

          <p className="sl-hero-sub">
            Manage all bike sale listings, verify shops, track inventory, and
            maintain quality standards across the platform.
          </p>
        </div>
      </div>

      {loadError ? (
        <p className="sl-hero-sub" style={{ color: "#b45309", marginTop: -12 }}>
          {loadError}
        </p>
      ) : null}

      <div className="sl-stats">
        <div className="sl-stat">
          <div className="sl-stat-ic blue" aria-hidden>
            🏪
          </div>

          <div className="sl-stat-num">{stats.total}</div>

          <div className="sl-stat-lbl">Rows (owners + extras)</div>

          <div className="sl-stat-trend muted">
            <span>●</span> <span>Live from Firestore</span>
          </div>
        </div>

        <div className="sl-stat">
          <div className="sl-stat-ic green" aria-hidden>
            ✓
          </div>

          <div className="sl-stat-num">{stats.verified}</div>

          <div className="sl-stat-lbl">Verified directory</div>

          <div className="sl-stat-trend muted">
            <span>●</span>{" "}
            <span>
              {stats.total > 0 ? `${stats.verifiedPct}% of rows` : "—"}
            </span>
          </div>
        </div>

        <div className="sl-stat">
          <div className="sl-stat-ic purple" aria-hidden>
            ⏳
          </div>

          <div className="sl-stat-num">{stats.pending}</div>

          <div className="sl-stat-lbl">Pending directory</div>

          <div className="sl-stat-trend muted">
            <span>●</span>{" "}
            <span>
              {stats.pending > 0
                ? `${stats.pending} awaiting review`
                : "None pending"}
            </span>
          </div>
        </div>

        <div className="sl-stat">
          <div className="sl-stat-ic orange" aria-hidden>
            📭
          </div>

          <div className="sl-stat-num">{stats.unlisted}</div>

          <div className="sl-stat-lbl">No directory row</div>

          <div className="sl-stat-trend muted">
            <span>●</span> <span>Publish from shop portal</span>
          </div>
        </div>

        <div className="sl-stat">
          <div className="sl-stat-ic orange" aria-hidden>
            🏍️
          </div>

          <div className="sl-stat-num">{stats.listings.toLocaleString()}</div>

          <div className="sl-stat-lbl">Active bike listings</div>

          <div className="sl-stat-trend muted">
            <span>●</span> <span>Counted from bikes</span>
          </div>
        </div>
      </div>

      <div className="sl-sec" id="sl-all-shops">
        <div className="sl-sec-h">
          <h2 className="sl-sec-t">Bike sale owners & directory</h2>

          <div className="sl-sec-btns">
            <button
              type="button"
              className="sl-btn sl-btn-sec"
              onClick={exportCsv}
            >
              <span>📥</span> Export
            </button>

            <button
              type="button"
              className="sl-btn sl-btn-pri"
              onClick={openModal}
            >
              <span>➕</span> Add New Shop
            </button>
          </div>
        </div>

        <div className="sl-filt">
          <div className="sl-fg">
            <span className="sl-f-l">🔍 Search</span>

            <input
              className="sl-fi"
              placeholder="Shop name…"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="sl-fg">
            <span className="sl-f-l">📍 District</span>

            <select
              className="sl-fs"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              disabled={loading}
            >
              <option value="all">All Districts</option>

              {SRI_LANKA_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="sl-fg">
            <span className="sl-f-l">⚡ Directory</span>

            <select
              className="sl-fs"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={loading}
            >
              <option value="all">All</option>

              <option value="verified">Verified</option>

              <option value="pending">Pending</option>

              <option value="owner-pending">Pending owner approval</option>

              <option value="none">No directory row</option>
            </select>
          </div>

          <div className="sl-fg">
            <span className="sl-f-l">📊 Sort By</span>

            <select
              className="sl-fs"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              disabled={loading}
            >
              <option value="newest">Newest First</option>

              <option value="name">Name A–Z</option>

              <option value="listings">Most Listings</option>
            </select>
          </div>

          <div className="sl-fg sl-filt-actions">
            <button
              type="button"
              className="sl-btn sl-btn-pri"
              onClick={applyFilters}
              disabled={loading}
            >
              Apply Filters
            </button>
          </div>
        </div>

        <div className="sl-grid">
          {isFirebaseConfigured && loading ? (
            <div className="sl-empty">
              <div className="sl-ei">⏳</div>

              <div className="sl-et">Loading shops…</div>

              <p className="sl-ep">
                Reading users, bikes, reviews, and saleShops
              </p>
            </div>
          ) : shops.length === 0 ? (
            <div className="sl-empty">
              <div className="sl-ei">🏪</div>

              <div className="sl-et">No bike sale rows yet</div>

              <p className="sl-ep">
                Approved owners with the bike-sale business line (or legacy
                empty categories) appear here. Add bikes under a shop owner to
                see listing counts, or use <strong>Add Shop</strong> for a
                standalone directory entry.
              </p>

              <button
                type="button"
                className="sl-btn sl-btn-pri"
                onClick={openModal}
              >
                ➕ Add shop
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="sl-empty">
              <div className="sl-ei">🔍</div>

              <div className="sl-et">No shops match</div>

              <p className="sl-ep">
                Clear filters, this page&apos;s search box, and the{" "}
                <strong>Admin</strong> header search (top bar)—all of them
                filter this grid.
              </p>
            </div>
          ) : (
            filtered.map((s) => (
              <div key={s.id} className="sl-card">
                <div className="sl-card-h">
                  <h3 className="sl-card-t">{s.name}</h3>

                  <p className="sl-card-sub">
                    📍 {s.city}, {s.district}
                  </p>
                </div>

                <div className="sl-card-b">
                  <div className={`sl-badge ${s.directoryStatus}`}>
                    {directoryLabel(s.directoryStatus)}
                  </div>

                  <div className="sl-rows">
                    {[
                      ["👤", "Owner", s.owner],

                      ["📞", "Contact", s.phone],

                      ["📧", "Email", s.email],

                      ["📍", "Address", s.address],
                    ].map(([ico, label, val]) => (
                      <div key={String(label)} className="sl-row">
                        <span className="sl-ico" aria-hidden>
                          {ico}
                        </span>

                        <div>
                          <div className="sl-rl">{label}</div>

                          <div className="sl-rv">{val}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="sl-mini">
                    <div>
                      <span className="sl-mn">{s.listings}</span>

                      <span className="sl-ms">Listings</span>
                    </div>

                    <div>
                      <span className="sl-mn">{s.rating.toFixed(1)}</span>

                      <span className="sl-ms">Rating</span>
                    </div>

                    <div>
                      <span className="sl-mn" style={{ fontSize: 17 }}>
                        {s.established}
                      </span>

                      <span className="sl-ms">Est.</span>
                    </div>
                  </div>

                  <div className="sl-act">
                    <button
                      type="button"
                      className="sl-btn sl-b-v"
                      onClick={() => setViewRow(s)}
                    >
                      <span>👁</span> View
                    </button>

                    <button
                      type="button"
                      className="sl-btn sl-b-e"
                      onClick={() => void openEdit(s)}
                    >
                      <span>✏️</span> Edit
                    </button>

                    <button
                      type="button"
                      className="sl-btn sl-b-del"
                      disabled={
                        !s.ownerUid ||
                        deletingUid === s.ownerUid ||
                        s.ownerUid === adminUid
                      }
                      title={
                        !s.ownerUid
                          ? "No owner uid on this row — nothing to delete from users"
                          : s.ownerUid === adminUid
                            ? "Cannot delete your own account"
                            : "Delete users document"
                      }
                      onClick={() =>
                        void deleteOwnerUser(s.ownerUid, s.name)
                      }
                    >
                      <span>🗑</span>{" "}
                      {deletingUid === s.ownerUid ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {modalOpen ? (
        <div
          className="sl-mod-bg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sl-mod-title"
          onClick={closeModal}
        >
          <div className="sl-mod" onClick={(e) => e.stopPropagation()}>
            <div className="sl-mod-hd">
              <h2 className="sl-mod-t" id="sl-mod-title">
                <span>➕</span> Add New Shop
              </h2>

              <button
                type="button"
                className="sl-x"
                onClick={closeModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={addShop}>
              <p
                className="sl-hero-sub"
                style={{ margin: "0 0 16px", lineHeight: 1.45 }}
              >
                Creates a Firebase login for the shop (bike sale line) and a pending owner profile, then writes{" "}
                <code className="sl-hero-code">saleShops/{"{uid}"}</code> for the directory. Deploy updated Firestore
                rules if creation is denied.
              </p>

              <div className="sl-fgrid">
                <div className="sl-ffg full">
                  <span className="ll">Shop name</span>

                  <input
                    className="i"
                    name="shopName"
                    required
                    placeholder="e.g., Speed Motors"
                    disabled={shopMutating}
                  />
                </div>

                <div className="sl-ffg">
                  <span className="ll">Owner</span>

                  <input
                    className="i"
                    name="ownerName"
                    required
                    placeholder="Owner"
                    disabled={shopMutating}
                  />
                </div>

                <div className="sl-ffg">
                  <span className="ll">Contact</span>

                  <input
                    className="i"
                    name="phone"
                    type="tel"
                    required
                    disabled={shopMutating}
                  />
                </div>

                <div className="sl-ffg">
                  <span className="ll">Email (login)</span>

                  <input
                    className="i"
                    name="email"
                    type="email"
                    autoComplete="off"
                    required
                    disabled={shopMutating}
                  />
                </div>

                <div className="sl-ffg">
                  <span className="ll">Password</span>

                  <input
                    className="i"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    minLength={6}
                    required
                    disabled={shopMutating}
                  />
                </div>

                <div className="sl-ffg">
                  <span className="ll">Confirm password</span>

                  <input
                    className="i"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    minLength={6}
                    required
                    disabled={shopMutating}
                  />
                </div>

                <div className="sl-ffg">
                  <span className="ll">District</span>

                  <select
                    className="i"
                    name="district"
                    required
                    defaultValue=""
                    disabled={shopMutating}
                  >
                    <option value="" disabled>
                      Select
                    </option>

                    {SRI_LANKA_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sl-ffg">
                  <span className="ll">City</span>

                  <input className="i" name="city" required disabled={shopMutating} />
                </div>

                <div className="sl-ffg full">
                  <span className="ll">Full address</span>

                  <input className="i" name="address" required disabled={shopMutating} />
                </div>

                <div className="sl-ffg">
                  <span className="ll">Total listings</span>

                  <input
                    className="i"
                    name="listings"
                    type="number"
                    min={0}
                    defaultValue={0}
                    disabled={shopMutating}
                  />
                </div>

                <div className="sl-ffg">
                  <span className="ll">Rating</span>

                  <select className="i" name="rating" defaultValue="4.5" disabled={shopMutating}>
                    <option value="5.0">5.0</option>

                    <option value="4.8">4.8</option>

                    <option value="4.5">4.5</option>

                    <option value="4.2">4.2</option>

                    <option value="4.0">4.0</option>
                  </select>
                </div>

                <div className="sl-ffg">
                  <span className="ll">Status</span>

                  <select
                    className="i"
                    name="status"
                    defaultValue="pending"
                    required
                    disabled={shopMutating}
                  >
                    <option value="verified">Verified</option>

                    <option value="pending">Pending review</option>
                  </select>
                </div>

                <div className="sl-ffg">
                  <span className="ll">Established</span>

                  <input
                    className="i"
                    name="established"
                    type="number"
                    min={1990}
                    max={2030}
                    disabled={shopMutating}
                  />
                </div>

                <div className="sl-ffg full">
                  <span className="ll">Description (optional)</span>

                  <textarea className="i" name="description" rows={3} disabled={shopMutating} />
                </div>
              </div>

              <div className="sl-mft">
                <button
                  type="button"
                  className="sl-btn sl-btn-sec"
                  onClick={closeModal}
                  disabled={shopMutating}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="sl-btn sl-btn-pri"
                  disabled={shopMutating || loading}
                >
                  {shopMutating ? "Creating…" : "Create shop account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {viewRow ? (
        <div
          className="sl-mod-bg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sl-view-title"
          onClick={() => setViewRow(null)}
        >
          <div className="sl-mod" onClick={(e) => e.stopPropagation()}>
            <div className="sl-mod-hd">
              <h2 className="sl-mod-t" id="sl-view-title">
                Shop details
              </h2>

              <button
                type="button"
                className="sl-x"
                onClick={() => setViewRow(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="sl-fgrid">
              {(
                [
                  ["Row id", viewRow.id],
                  ["Owner uid", viewRow.ownerUid || "—"],
                  ["Directory status", viewRow.directoryStatus],
                  ["Directory doc id", viewRow.directoryDocId || "—"],
                  ["Shop name", viewRow.name],
                  ["Owner", viewRow.owner],
                  ["Phone", viewRow.phone],
                  ["Email", viewRow.email],
                  ["District", viewRow.district],
                  ["City", viewRow.city],
                  ["Address", viewRow.address],
                  ["Listings (live bikes)", String(viewRow.listings)],
                  ["Rating (shown)", viewRow.rating.toFixed(1)],
                  ["Established", viewRow.established],
                  ["Description", viewRow.description || "—"],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="sl-ffg full">
                  <span className="ll">{k}</span>

                  <div className="i" style={{ border: "none", paddingLeft: 0 }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>

            <div className="sl-mft">
              <button
                type="button"
                className="sl-btn sl-btn-pri"
                onClick={() => setViewRow(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editModal ? (
        <div
          className="sl-mod-bg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sl-edit-title"
          onClick={closeEdit}
        >
          <div className="sl-mod" onClick={(e) => e.stopPropagation()}>
            <div className="sl-mod-hd">
              <h2 className="sl-mod-t" id="sl-edit-title">
                {editModal.mode === "directory"
                  ? "Edit directory entry"
                  : "Edit owner profile"}
              </h2>

              <button
                type="button"
                className="sl-x"
                onClick={closeEdit}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {editModal.loading ? (
              <p className="sl-hero-sub" style={{ padding: "16px 0" }}>
                Loading…
              </p>
            ) : editModal.mode === "directory" ? (
              <form onSubmit={submitDirectoryEdit}>
                <div className="sl-fgrid">
                  {(() => {
                    const d = editModal.doc;

                    const r = editModal.row;

                    const estRaw = d?.established ?? r.established;

                    const estNum = parseInt(String(estRaw), 10);

                    return (
                      <>
                        <div className="sl-ffg full">
                          <span className="ll">Shop name</span>

                          <input
                            className="i"
                            name="shopName"
                            required
                            defaultValue={d?.name ?? r.name}
                          />
                        </div>

                        <div className="sl-ffg">
                          <span className="ll">Owner</span>

                          <input
                            className="i"
                            name="ownerName"
                            required
                            defaultValue={d?.owner ?? r.owner}
                          />
                        </div>

                        <div className="sl-ffg">
                          <span className="ll">Contact</span>

                          <input
                            className="i"
                            name="phone"
                            type="tel"
                            required
                            defaultValue={d?.phone ?? r.phone}
                          />
                        </div>

                        <div className="sl-ffg">
                          <span className="ll">Email</span>

                          <input
                            className="i"
                            name="email"
                            type="email"
                            required
                            defaultValue={d?.email ?? r.email}
                          />
                        </div>

                        <div className="sl-ffg">
                          <span className="ll">District</span>

                          <select
                            className="i"
                            name="district"
                            required
                            defaultValue={d?.district ?? r.district}
                          >
                            <option value="" disabled>
                              Select
                            </option>

                            {SRI_LANKA_DISTRICTS.map((dist) => (
                              <option key={dist} value={dist}>
                                {dist}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sl-ffg">
                          <span className="ll">City</span>

                          <input
                            className="i"
                            name="city"
                            required
                            defaultValue={d?.city ?? r.city}
                          />
                        </div>

                        <div className="sl-ffg full">
                          <span className="ll">Full address</span>

                          <input
                            className="i"
                            name="address"
                            required
                            defaultValue={d?.address ?? r.address}
                          />
                        </div>

                        <div className="sl-ffg">
                          <span className="ll">Listings (stored)</span>

                          <input
                            className="i"
                            name="listings"
                            type="number"
                            min={0}
                            defaultValue={d?.listings ?? r.listings}
                          />
                        </div>

                        <div className="sl-ffg">
                          <span className="ll">Rating</span>

                          <select
                            className="i"
                            name="rating"
                            defaultValue={String(d?.rating ?? r.rating)}
                          >
                            <option value="5.0">5.0</option>

                            <option value="4.8">4.8</option>

                            <option value="4.5">4.5</option>

                            <option value="4.2">4.2</option>

                            <option value="4.0">4.0</option>
                          </select>
                        </div>

                        <div className="sl-ffg">
                          <span className="ll">Status</span>

                          <select
                            className="i"
                            name="status"
                            required
                            defaultValue={d?.status ?? "pending"}
                          >
                            <option value="verified">Verified</option>

                            <option value="pending">Pending review</option>
                          </select>
                        </div>

                        <div className="sl-ffg">
                          <span className="ll">Established</span>

                          <input
                            className="i"
                            name="established"
                            type="number"
                            min={1990}
                            max={2030}
                            defaultValue={
                              Number.isFinite(estNum) ? estNum : undefined
                            }
                          />
                        </div>

                        <div className="sl-ffg full">
                          <span className="ll">Shop owner Firebase UID (optional)</span>

                          <input
                            className="i"
                            name="ownerUid"
                            type="text"
                            placeholder="Links bike listings"
                            autoComplete="off"
                            defaultValue={d?.ownerId ?? r.ownerUid}
                          />
                        </div>

                        <div className="sl-ffg full">
                          <span className="ll">Description (optional)</span>

                          <textarea
                            className="i"
                            name="description"
                            rows={3}
                            defaultValue={d?.description ?? ""}
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="sl-mft">
                  <button
                    type="button"
                    className="sl-btn sl-btn-sec"
                    onClick={closeEdit}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="sl-btn sl-btn-pri"
                    disabled={shopMutating}
                  >
                    {shopMutating ? "Saving…" : "✓ Save directory"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={submitProfileEdit}>
                <div className="sl-fgrid">
                  {(() => {
                    const p = editModal.profile;

                    const r = editModal.row;

                    return (
                      <>
                        <div className="sl-ffg full">
                          <span className="ll">Shop name</span>

                          <input
                            className="i"
                            name="shopName"
                            required
                            defaultValue={p?.shopName ?? r.name}
                          />
                        </div>

                        <div className="sl-ffg">
                          <span className="ll">Display name</span>

                          <input
                            className="i"
                            name="displayName"
                            required
                            defaultValue={p?.displayName ?? r.owner}
                          />
                        </div>

                        <div className="sl-ffg">
                          <span className="ll">Phone</span>

                          <input
                            className="i"
                            name="phone"
                            defaultValue={p?.phone ?? r.phone}
                          />
                        </div>

                        <div className="sl-ffg">
                          <span className="ll">WhatsApp</span>

                          <input
                            className="i"
                            name="whatsapp"
                            defaultValue={p?.whatsapp ?? ""}
                          />
                        </div>

                        <div className="sl-ffg full">
                          <span className="ll">Shop address</span>

                          <input
                            className="i"
                            name="shopAddress"
                            defaultValue={p?.shopAddress ?? r.address}
                          />
                        </div>

                        <div className="sl-ffg">
                          <span className="ll">City / location</span>

                          <input
                            className="i"
                            name="location"
                            defaultValue={p?.location ?? r.city}
                          />
                        </div>

                        <div className="sl-ffg">
                          <span className="ll">District</span>

                          <select
                            className="i"
                            name="district"
                            defaultValue={p?.district ?? r.district}
                          >
                            <option value="">—</option>

                            {SRI_LANKA_DISTRICTS.map((dist) => (
                              <option key={dist} value={dist}>
                                {dist}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="sl-mft">
                  <button
                    type="button"
                    className="sl-btn sl-btn-sec"
                    onClick={closeEdit}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="sl-btn sl-btn-pri"
                    disabled={shopMutating}
                  >
                    {shopMutating ? "Saving…" : "✓ Save profile"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
