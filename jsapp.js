/**
 * Travel Agency Sales Automation — client-side demo app
 */
(function () {
  const STORAGE = {
    session: "tas_session_v1",
    visits: "tas_visits_v1",
    expenses: "tas_expenses_v1",
    prospects: "tas_prospects_v1",
    assignments: "tas_assignments_v1",
  };

  const TOLERANCE_M = 150;

  const AGENCIES = [
    { id: "a1", name: "Skyline Tours", city: "Mumbai", contact: "A. Mehta", phone: "+91 98xxx 10001", category: "active", temp: "hot", lat: 19.076, lng: 72.8777 },
    { id: "a2", name: "Heritage Travels", city: "Mumbai", contact: "R. Shah", phone: "+91 98xxx 10002", category: "active", temp: "warm", lat: 19.0544, lng: 72.8406 },
    { id: "a3", name: "Coastal Holidays", city: "Goa", contact: "S. D'Souza", phone: "+91 98xxx 10003", category: "prospect", temp: "warm", lat: 15.4986, lng: 73.9108 },
    { id: "a4", name: "Royal Wings", city: "Delhi", contact: "K. Singh", phone: "+91 98xxx 10004", category: "inactive", temp: "cold", lat: 28.6139, lng: 77.209 },
    { id: "a5", name: "Golden Route Agencies", city: "Bengaluru", contact: "P. Nair", phone: "+91 98xxx 10005", category: "active", temp: "hot", lat: 12.9716, lng: 77.5946 },
  ];

  const STAFF = [
    { id: "s1", name: "Riya Sharma", role: "executive" },
    { id: "s2", name: "A. Khan", role: "executive" },
    { id: "s3", name: "S. Patel", role: "executive" },
    { id: "s4", name: "M. Das", role: "executive" },
  ];

  function haversineM(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function getSession() {
    return loadJSON(STORAGE.session, null);
  }

  function setSession(s) {
    if (s) saveJSON(STORAGE.session, s);
    else localStorage.removeItem(STORAGE.session);
  }

  function getVisits() {
    return loadJSON(STORAGE.visits, []);
  }

  function saveVisits(list) {
    saveJSON(STORAGE.visits, list);
  }

  function getExpenses() {
    return loadJSON(STORAGE.expenses, []);
  }

  function saveExpenses(list) {
    saveJSON(STORAGE.expenses, list);
  }

  function getProspects() {
    return loadJSON(STORAGE.prospects, []);
  }

  function saveProspects(list) {
    saveJSON(STORAGE.prospects, list);
  }

  function getAssignments() {
    return loadJSON(STORAGE.assignments, []);
  }

  function saveAssignments(list) {
    saveJSON(STORAGE.assignments, list);
  }

  function isAdmin() {
    return getSession()?.role === "admin";
  }

  function canManageTeam() {
    const role = getSession()?.role;
    return role === "admin" || role === "manager";
  }

  function getStaffNameForVisit(visit, idx) {
    const names = ["Riya Sharma", "A. Khan", "S. Patel", "M. Das"];
    if (visit && visit.staffName) return visit.staffName;
    return names[idx % names.length];
  }

  /* --- DOM refs --- */
  const screens = {
    login: document.getElementById("screen-login"),
    home: document.getElementById("screen-home"),
    map: document.getElementById("screen-map"),
    visits: document.getElementById("screen-visits"),
    visitNew: document.getElementById("screen-visit-new"),
    visitDetail: document.getElementById("screen-visit-detail"),
    more: document.getElementById("screen-more"),
    expenses: document.getElementById("screen-expenses"),
    expenseNew: document.getElementById("screen-expense-new"),
    prospects: document.getElementById("screen-prospects"),
    manager: document.getElementById("screen-manager"),
    admin: document.getElementById("screen-admin"),
  };

  const bottomNav = document.getElementById("bottom-nav");
  const fabWrap = document.getElementById("fab-wrap");

  let mapInstance = null;
  let mapMarkers = [];
  let visitWizardStep = 1;
  let capturedGeo = null;
  let capturedSelfie = null;
  let otpSent = false;

  function showScreen(name) {
    Object.keys(screens).forEach((k) => {
      if (screens[k]) screens[k].classList.toggle("active", k === name);
    });

    const hideNav = ["login", "visitNew", "visitDetail", "expenseNew", "prospects", "manager", "admin"];
    bottomNav.classList.toggle("hidden", hideNav.includes(name));
    fabWrap.classList.toggle("hidden", name !== "home" && name !== "visits");

    document.querySelectorAll(".bottom-nav button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === name);
    });

    if (name === "map") initMap();
    if (name === "home") renderHome();
    if (name === "visits") renderVisitsList();
    if (name === "more") renderMore();
    if (name === "expenses") renderExpenses();
    if (name === "expenseNew") renderExpenseNew();
    if (name === "prospects") renderProspects();
    if (name === "manager") renderManager();
    if (name === "admin") renderAdmin();
  }

  function navigate(route) {
    window.location.hash = route;
  }

  function parseHash() {
    const h = (window.location.hash || "#/").slice(1).replace(/^\//, "");
    const parts = h.split("/").filter(Boolean);
    return { parts, raw: h };
  }

  function route() {
    const { parts } = parseHash();
    const sess = getSession();

    if (!sess) {
      showScreen("login");
      return;
    }

    const [a, b, c] = parts;
    if (a === "visit" && b === "new") {
      resetVisitWizard();
      showScreen("visitNew");
      return;
    }
    if (a === "visit" && b) {
      showVisitDetail(b);
      showScreen("visitDetail");
      return;
    }
    if (a === "expenses" && b === "new") {
      showScreen("expenseNew");
      return;
    }
    if (a === "expenses") {
      showScreen("expenses");
      return;
    }
    if (a === "prospects") {
      showScreen("prospects");
      return;
    }
    if (a === "manager") {
      if (!canManageTeam()) {
        navigate("/home");
        return;
      }
      showScreen("manager");
      return;
    }
    if (a === "admin") {
      if (!isAdmin()) {
        navigate("/home");
        return;
      }
      showScreen("admin");
      return;
    }

    const tab = a || "home";
    if (["home", "map", "visits", "more"].includes(tab)) showScreen(tab);
    else navigate("/home");
  }

  /* --- Home --- */
  function renderHome() {
    const visits = getVisits().sort((x, y) => new Date(y.ts) - new Date(x.ts));
    const today = new Date().toDateString();
    const todayVisits = visits.filter((v) => new Date(v.ts).toDateString() === today);

    const sess = getSession();
    const greeting =
      sess.role === "admin"
        ? "Admin overview"
        : sess.role === "manager"
          ? "Manager overview"
          : `Good day, ${sess.name}`;
    document.getElementById("home-greeting").textContent = greeting;

    const pulse = document.getElementById("home-pulse");
    pulse.innerHTML = `
      <div class="card">
        <div class="row-between">
          <div><h3>Today</h3><p class="meta">${todayVisits.length} visits logged</p></div>
          <span class="tag ${todayVisits.length ? "ok" : "pending"}">${todayVisits.length ? "On track" : "Log a visit"}</span>
        </div>
      </div>`;

    const list = document.getElementById("home-agencies");
    list.innerHTML = AGENCIES.slice(0, 4)
      .map(
        (ag) => `
      <div class="card" data-agency="${ag.id}" style="cursor:pointer">
        <div class="row-between">
          <div>
            <h3>${escapeHtml(ag.name)}</h3>
            <p class="meta">${escapeHtml(ag.city)} · ${escapeHtml(ag.contact)}</p>
          </div>
          <span class="tag ${ag.temp}">${ag.temp}</span>
        </div>
      </div>`
      )
      .join("");

    list.querySelectorAll(".card").forEach((el) => {
      el.addEventListener("click", () => navigate(`/map`));
    });

    const follow = document.getElementById("home-followups");
    const withFollow = visits.filter((v) => v.nextFollowup);
    follow.innerHTML =
      withFollow.length === 0
        ? `<p class="empty" style="padding:0.5rem">No pending follow-ups.</p>`
        : withFollow
            .slice(0, 3)
            .map(
              (v) => `
        <div class="card">
          <strong>${escapeHtml(v.agencyName)}</strong>
          <p class="meta">Follow-up by ${escapeHtml(v.nextFollowup)}</p>
        </div>`
            )
            .join("");
  }

  /* --- Map --- */
  function initMap() {
    const el = document.getElementById("map");
    if (!window.L || !el) return;

    const defaultCenter = [20.5937, 78.9629];
    if (!mapInstance) {
      mapInstance = L.map(el, { zoomControl: true }).setView(defaultCenter, 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(mapInstance);
    }

    mapMarkers.forEach((m) => mapInstance.removeLayer(m));
    mapMarkers = [];

    AGENCIES.forEach((ag) => {
      const m = L.marker([ag.lat, ag.lng])
        .addTo(mapInstance)
        .bindPopup(`<b>${escapeHtml(ag.name)}</b><br>${escapeHtml(ag.city)}`);
      mapMarkers.push(m);
    });

    if (AGENCIES.length) {
      const b = L.latLngBounds(AGENCIES.map((a) => [a.lat, a.lng]));
      mapInstance.fitBounds(b, { padding: [40, 40], maxZoom: 12 });
    }

    const selected = document.getElementById("map-selected");
    selected.innerHTML =
      `<p class="meta">Tap a pin for agency name. Use <strong>Log visit</strong> after your meeting.</p>`;
  }

  /* --- Visits --- */
  function renderVisitsList() {
    const box = document.getElementById("visits-list");
    const visits = getVisits().sort((x, y) => new Date(y.ts) - new Date(x.ts));
    if (!visits.length) {
      box.innerHTML = `<div class="empty">No visits yet. Tap <strong>Log visit</strong>.</div>`;
      return;
    }
    box.innerHTML = visits
      .map(
        (v) => `
      <div class="card" data-visit="${v.id}" style="cursor:pointer">
        <div class="row-between">
          <div>
            <h3>${escapeHtml(v.agencyName)}</h3>
            <p class="meta">${formatDate(v.ts)} · ${escapeHtml(v.purpose)}</p>
          </div>
          <span class="tag ${v.verification === "verified" ? "ok" : v.verification === "mismatch" ? "bad" : "pending"}">${v.verification}</span>
        </div>
      </div>`
      )
      .join("");

    box.querySelectorAll(".card").forEach((c) => {
      c.addEventListener("click", () => navigate(`/visit/${c.dataset.visit}`));
    });
  }

  function showVisitDetail(id) {
    const v = getVisits().find((x) => x.id === id);
    const body = document.getElementById("visit-detail-body");
    if (!v) {
      body.innerHTML = `<p class="empty">Visit not found.</p>`;
      return;
    }
    body.innerHTML = `
      <div class="card">
        <div class="row-between">
          <h3 style="margin:0">${escapeHtml(v.agencyName)}</h3>
          <span class="tag ${v.verification === "verified" ? "ok" : v.verification === "mismatch" ? "bad" : "pending"}">${v.verification}</span>
        </div>
        <p class="meta">${formatDate(v.ts)}</p>
        <p class="meta">Type: ${escapeHtml(v.visitType)} · Purpose: ${escapeHtml(v.purpose)}</p>
        ${v.distanceM != null ? `<p class="meta">Distance from agency: ${Math.round(v.distanceM)} m</p>` : ""}
        <p style="margin:0.75rem 0 0;font-size:0.9rem">${escapeHtml(v.notes || "—")}</p>
      </div>
      ${v.selfie ? `<div class="card"><strong>Proof</strong><div class="proof-preview" style="margin-top:0.5rem;padding:0;border-style:solid"><img src="${v.selfie}" alt="" /></div></div>` : ""}`;
  }

  /* --- Visit wizard --- */
  function fillAgencySelect() {
    const sel = document.getElementById("vn-agency");
    if (!sel) return;
    sel.innerHTML = AGENCIES.map(
      (ag) => `<option value="${ag.id}">${escapeHtml(ag.name)} (${escapeHtml(ag.city)})</option>`
    ).join("");
  }

  function resetVisitWizard() {
    visitWizardStep = 1;
    capturedGeo = null;
    capturedSelfie = null;
    fillAgencySelect();
    document.getElementById("vn-agency").value = AGENCIES[0]?.id || "";
    document.getElementById("vn-type").value = "unplanned";
    document.getElementById("vn-purpose").value = "follow-up";
    document.getElementById("vn-notes").value = "";
    document.getElementById("vn-followup").value = "";
    document.getElementById("vn-persons").value = "";
    document.getElementById("proof-preview-img").innerHTML = "Camera preview";
    document.getElementById("geo-status").className = "geo-banner pending";
    document.getElementById("geo-status").textContent = "Capture location to verify.";
    updateWizardUI();
  }

  function updateWizardUI() {
    document.querySelectorAll("#screen-visit-new .wizard-step").forEach((el, i) => {
      el.classList.toggle("hidden", i + 1 !== visitWizardStep);
    });
    document.querySelectorAll("#screen-visit-new .step-dot").forEach((el, i) => {
      el.classList.toggle("on", i < visitWizardStep);
    });
    const back = document.getElementById("vn-back");
    const next = document.getElementById("vn-next");
    back.classList.toggle("hidden", visitWizardStep === 1);
    next.textContent = visitWizardStep === 3 ? "Submit visit" : "Continue";
  }

  function verifyGeoForAgency(agencyId, lat, lng) {
    const ag = AGENCIES.find((x) => x.id === agencyId);
    if (!ag) return { verification: "pending", distanceM: null };
    const distanceM = haversineM(lat, lng, ag.lat, ag.lng);
    const verification = distanceM <= TOLERANCE_M ? "verified" : "mismatch";
    return { verification, distanceM };
  }

  /* --- Expenses --- */
  function renderExpenses() {
    const box = document.getElementById("expenses-list");
    const sess = getSession();
    const ex = getExpenses().sort((x, y) => new Date(y.ts) - new Date(x.ts));
    if (!ex.length) {
      box.innerHTML = `<div class="empty">No expenses. Add a bill photo entry.</div>`;
      return;
    }
    box.innerHTML =
      (sess.role !== "admin"
        ? `<div class="card"><p class="meta" style="margin:0">Expense approval is restricted to Admin (Head Office).</p></div>`
        : "") +
      ex
      .map(
        (e) => `
      <div class="card">
        <div class="row-between">
          <div><h3>₹ ${escapeHtml(String(e.amount))}</h3><p class="meta">${escapeHtml(e.category)} · ${formatDate(e.ts)}</p></div>
          <span class="tag ${e.status === "approved" ? "ok" : e.status === "rejected" ? "bad" : "pending"}">${e.status}</span>
        </div>
        ${e.visitId ? `<p class="meta">Linked visit</p>` : ""}
      </div>`
      )
      .join("");
  }

  function renderExpenseNew() {
    const sel = document.getElementById("en-visit");
    if (!sel) return;
    const visits = getVisits().sort((x, y) => new Date(y.ts) - new Date(x.ts));
    sel.innerHTML =
      `<option value="">No link</option>` +
      visits
        .map(
          (v) =>
            `<option value="${v.id}">${escapeHtml(v.agencyName)} — ${formatDate(v.ts)}</option>`
        )
        .join("");
  }

  function renderMore() {
    const sess = getSession();
    document.getElementById("more-profile").textContent = `${sess.name} · ${sess.phone}`;
    document.getElementById("more-role").textContent = sess.role;
    document.getElementById("more-admin").classList.toggle("hidden", !isAdmin());
    document.getElementById("more-manager").classList.toggle("hidden", !canManageTeam());
    document.getElementById("more-prospects").classList.toggle("hidden", !["admin", "manager", "executive"].includes(sess.role));
  }

  function renderProspects() {
    const prospects = getProspects().sort((x, y) => new Date(y.ts) - new Date(x.ts));
    const box = document.getElementById("pro-list");
    box.innerHTML =
      prospects.length === 0
        ? `<div class="admin-empty">No prospects added yet.</div>`
        : prospects
            .map(
              (p) => `
          <div class="card">
            <div class="row-between">
              <div>
                <h3>${escapeHtml(p.name)}</h3>
                <p class="meta">${escapeHtml(p.city)} · by ${escapeHtml(p.createdBy)}</p>
              </div>
              <span class="tag ${p.temp}">${escapeHtml(p.temp)}</span>
            </div>
          </div>`
            )
            .join("");
  }

  function renderManager() {
    const staffSel = document.getElementById("mgr-staff");
    const agencySel = document.getElementById("mgr-agency");
    if (!staffSel || !agencySel) return;

    staffSel.innerHTML = STAFF.map(
      (s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`
    ).join("");
    agencySel.innerHTML = AGENCIES.map(
      (a) => `<option value="${a.id}">${escapeHtml(a.name)} (${escapeHtml(a.city)})</option>`
    ).join("");

    const assignments = getAssignments();
    const assignmentBox = document.getElementById("mgr-assignments");
    assignmentBox.innerHTML =
      assignments.length === 0
        ? `<div class="admin-empty">No agency assignments yet.</div>`
        : assignments
            .map((as) => {
              const staff = STAFF.find((s) => s.id === as.staffId);
              const ag = AGENCIES.find((a) => a.id === as.agencyId);
              return `
                <div class="card">
                  <div class="adm-row">
                    <div class="adm-staff">${escapeHtml(staff?.name || "Unknown")}</div>
                    <span class="tag pending">assigned</span>
                  </div>
                  <div class="adm-sub">${escapeHtml(ag?.name || "Unknown agency")} · ${formatDate(as.ts)}</div>
                </div>`;
            })
            .join("");

    const visits = getVisits();
    const perf = {};
    STAFF.forEach((s) => {
      perf[s.name] = { visits: 0, verified: 0 };
    });
    visits.forEach((v, idx) => {
      const name = getStaffNameForVisit(v, idx);
      if (!perf[name]) perf[name] = { visits: 0, verified: 0 };
      perf[name].visits += 1;
      if (v.verification === "verified") perf[name].verified += 1;
    });
    const perfRows = Object.entries(perf).sort((a, b) => b[1].visits - a[1].visits);
    document.getElementById("mgr-performance").innerHTML =
      perfRows.length === 0
        ? `<div class="admin-empty">No team activity yet.</div>`
        : perfRows
            .map(([name, p]) => {
              const score = p.visits ? Math.round((p.verified / p.visits) * 100) : 0;
              return `
                <div class="card">
                  <div class="adm-row">
                    <div class="adm-staff">${escapeHtml(name)}</div>
                    <div class="adm-sub">${p.visits} visits · ${score}% verified</div>
                  </div>
                  <div class="bar-track"><div class="bar-fill" style="width:${score}%"></div></div>
                </div>`;
            })
            .join("");

    const reviewable = visits.filter((v) => !v.reviewedByManager);
    const reviewBox = document.getElementById("mgr-review");
    reviewBox.innerHTML =
      reviewable.length === 0
        ? `<div class="admin-empty">No pending visit reviews.</div>`
        : reviewable
            .slice(0, 8)
            .map(
              (v) => `
                <div class="card">
                  <div class="adm-row">
                    <div>
                      <div class="adm-staff">${escapeHtml(v.agencyName)}</div>
                      <div class="adm-sub">${formatDate(v.ts)} · ${escapeHtml(v.staffName || "Executive")}</div>
                    </div>
                    <span class="tag ${v.verification === "verified" ? "ok" : v.verification === "mismatch" ? "bad" : "pending"}">${v.verification}</span>
                  </div>
                  <div class="inline-actions">
                    <button type="button" class="btn btn-secondary" data-review-visit="${v.id}">Mark reviewed</button>
                  </div>
                </div>`
            )
            .join("");

    reviewBox.querySelectorAll("[data-review-visit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!canManageTeam()) return;
        const id = btn.dataset.reviewVisit;
        const next = getVisits().map((v) =>
          v.id === id ? { ...v, reviewedByManager: true, reviewedAt: new Date().toISOString() } : v
        );
        saveVisits(next);
        renderManager();
      });
    });
  }

  function renderAdmin() {
    if (!isAdmin()) return;
    const statusFilter = document.getElementById("adm-filter-status")?.value || "all";
    const windowFilter = Number(document.getElementById("adm-filter-window")?.value || "7");
    const allVisits = getVisits().sort((x, y) => new Date(y.ts) - new Date(x.ts));
    const expenses = getExpenses().sort((x, y) => new Date(y.ts) - new Date(x.ts));

    const cutoff =
      windowFilter > 0 ? new Date(Date.now() - windowFilter * 24 * 60 * 60 * 1000) : null;
    let visits = allVisits.filter((v) => !cutoff || new Date(v.ts) >= cutoff);
    if (statusFilter !== "all") visits = visits.filter((v) => v.verification === statusFilter);

    const mismatch = visits.filter((v) => v.verification === "mismatch");
    const verified = visits.filter((v) => v.verification === "verified");
    const pendingExpenses = expenses.filter((e) => e.status === "pending");

    document.getElementById("adm-kpi-visits").textContent = String(visits.length);
    document.getElementById("adm-kpi-ver").textContent =
      visits.length ? Math.round((verified.length / visits.length) * 100) + "%" : "—";
    document.getElementById("adm-kpi-bad").textContent = String(mismatch.length);
    document.getElementById("adm-kpi-expenses").textContent = String(pendingExpenses.length);

    const suspicious = document.getElementById("adm-suspicious");
    suspicious.innerHTML =
      mismatch.length === 0
        ? `<div class="admin-empty">No suspicious visits in selected range.</div>`
        : mismatch
            .slice(0, 4)
            .map(
              (v, idx) => `
          <div class="card">
            <div class="adm-row">
              <div>
                <div class="adm-staff">${escapeHtml(getStaffNameForVisit(v, idx))}</div>
                <div class="adm-sub">${escapeHtml(v.agencyName)} · ${formatDate(v.ts)}</div>
              </div>
              <span class="tag bad">mismatch</span>
            </div>
            <div class="adm-sub" style="margin-top:0.4rem">Distance ${v.distanceM != null ? Math.round(v.distanceM) + " m" : "—"} (limit ${TOLERANCE_M} m)</div>
          </div>`
            )
            .join("");

    const tbody = document.getElementById("adm-tbody");
    tbody.innerHTML =
      visits.length === 0
        ? `<tr><td colspan="5" class="meta">No visits in this filter.</td></tr>`
        : visits
            .slice(0, 20)
            .map(
              (v, idx) => `
      <tr>
        <td>${escapeHtml(getStaffNameForVisit(v, idx))}</td>
        <td>${escapeHtml(v.agencyName)}</td>
        <td>${v.distanceM != null ? Math.round(v.distanceM) + " m" : "—"}</td>
        <td><span class="tag ${v.verification === "verified" ? "ok" : v.verification === "mismatch" ? "bad" : "pending"}">${v.verification}</span></td>
        <td>${formatDate(v.ts)}</td>
      </tr>`
            )
            .join("");

    const leaderboard = document.getElementById("adm-leaderboard");
    const staffStats = {};
    allVisits.forEach((v, idx) => {
      const staff = getStaffNameForVisit(v, idx);
      if (!staffStats[staff]) staffStats[staff] = { visits: 0, verified: 0 };
      staffStats[staff].visits += 1;
      if (v.verification === "verified") staffStats[staff].verified += 1;
    });
    const rows = Object.entries(staffStats)
      .map(([name, s]) => ({
        name,
        visits: s.visits,
        verifiedRate: s.visits ? Math.round((s.verified / s.visits) * 100) : 0,
      }))
      .sort((a, b) => b.visits - a.visits);
    leaderboard.innerHTML =
      rows.length === 0
        ? `<div class="admin-empty">No team data yet.</div>`
        : rows
            .map(
              (r) => `
          <div class="card">
            <div class="adm-row">
              <div class="adm-staff">${escapeHtml(r.name)}</div>
              <div class="adm-sub">${r.visits} visits · ${r.verifiedRate}% verified</div>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.min(r.verifiedRate, 100)}%"></div></div>
          </div>`
            )
            .join("");

    const review = document.getElementById("adm-expense-review");
    review.innerHTML =
      pendingExpenses.length === 0
        ? `<div class="admin-empty">No pending expense approvals.</div>`
        : pendingExpenses
            .slice(0, 8)
            .map(
              (e) => `
          <div class="card">
            <div class="adm-row">
              <div>
                <div class="adm-staff">₹ ${escapeHtml(String(e.amount))}</div>
                <div class="adm-sub">${escapeHtml(e.category)} · ${formatDate(e.ts)}</div>
              </div>
              <span class="tag pending">pending</span>
            </div>
            <div class="inline-actions">
              <button type="button" class="btn btn-secondary" data-exp-act="approve" data-exp-id="${e.id}">Approve</button>
              <button type="button" class="btn btn-danger" data-exp-act="reject" data-exp-id="${e.id}">Reject</button>
            </div>
          </div>`
            )
            .join("");

    review.querySelectorAll("button[data-exp-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!isAdmin()) {
          alert("Only Admin can approve or reject expenses.");
          return;
        }
        const action = btn.dataset.expAct;
        const id = btn.dataset.expId;
        const next = getExpenses().map((e) =>
          e.id === id ? { ...e, status: action === "approve" ? "approved" : "rejected" } : e
        );
        saveExpenses(next);
        renderAdmin();
      });
    });
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return iso;
    }
  }

  function escapeHtml(s) {
    if (!s) return "";
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  /* --- Events: login --- */
  document.getElementById("btn-send-otp").addEventListener("click", () => {
    const phone = document.getElementById("login-phone").value.trim();
    if (phone.length < 8) {
      alert("Enter a valid mobile number.");
      return;
    }
    otpSent = true;
    document.getElementById("otp-block").classList.remove("hidden");
    document.getElementById("login-hint").textContent =
      "Demo: use OTP 123456. Phone ending 1 = admin, 2 = manager.";
  });

  document.getElementById("btn-verify").addEventListener("click", () => {
    const phone = document.getElementById("login-phone").value.trim();
    const otp = document.getElementById("login-otp").value.trim();
    if (!otpSent) {
      alert("Send OTP first.");
      return;
    }
    if (otp !== "123456") {
      alert("Invalid OTP. Try 123456 for this demo.");
      return;
    }
    const isAdmin = phone.endsWith("1") || phone.includes("999");
    const isManager = !isAdmin && (phone.endsWith("2") || phone.includes("888"));
    const role = isAdmin ? "admin" : isManager ? "manager" : "executive";
    setSession({
      phone,
      name: isAdmin ? "Head Office Admin" : isManager ? "Sales Manager" : "Riya Sharma",
      role,
    });
    navigate("/home");
  });

  document.getElementById("btn-logout").addEventListener("click", () => {
    setSession(null);
    otpSent = false;
    document.getElementById("otp-block").classList.add("hidden");
    navigate("/");
  });

  /* Bottom nav */
  document.querySelectorAll(".bottom-nav button").forEach((btn) => {
    btn.addEventListener("click", () => navigate(`/${btn.dataset.tab}`));
  });

  document.getElementById("fab-log-visit").addEventListener("click", () => navigate("/visit/new"));

  document.getElementById("home-notif").addEventListener("click", () => {
    alert("Demo: push reminders would appear here.");
  });

  document.getElementById("map-back").addEventListener("click", () => navigate("/home"));

  document.getElementById("vn-close").addEventListener("click", () => navigate("/home"));
  document.getElementById("vn-back").addEventListener("click", () => {
    if (visitWizardStep > 1) {
      visitWizardStep--;
      updateWizardUI();
    }
  });

  document.getElementById("vn-next").addEventListener("click", () => {
    if (visitWizardStep === 1) {
      visitWizardStep = 2;
      updateWizardUI();
      return;
    }
    if (visitWizardStep === 2) {
      if (!capturedGeo) {
        alert("Capture GPS location first.");
        return;
      }
      visitWizardStep = 3;
      updateWizardUI();
      return;
    }
    if (visitWizardStep === 3) {
      const agencyId = document.getElementById("vn-agency").value;
      const ag = AGENCIES.find((x) => x.id === agencyId);
      const notes = document.getElementById("vn-notes").value.trim();
      const follow = document.getElementById("vn-followup").value;
      const { verification, distanceM } = verifyGeoForAgency(agencyId, capturedGeo.lat, capturedGeo.lng);

      const visit = {
        id: crypto.randomUUID(),
        staffName: getSession().name,
        agencyId,
        agencyName: ag?.name || "Unknown",
        visitType: document.getElementById("vn-type").value,
        purpose: document.getElementById("vn-purpose").value,
        notes,
        nextFollowup: follow || null,
        personsMet: document.getElementById("vn-persons").value.trim(),
        lat: capturedGeo.lat,
        lng: capturedGeo.lng,
        verification,
        distanceM,
        selfie: capturedSelfie,
        ts: new Date().toISOString(),
      };
      const list = getVisits();
      list.unshift(visit);
      saveVisits(list);
      navigate(`/visit/${visit.id}`);
    }
  });

  document.getElementById("btn-capture-geo").addEventListener("click", () => {
    const agencyId = document.getElementById("vn-agency").value;
    const banner = document.getElementById("geo-status");

    if (!navigator.geolocation) {
      banner.className = "geo-banner bad";
      banner.textContent = "Geolocation not available. Use demo fix below.";
      return;
    }

    banner.className = "geo-banner pending";
    banner.textContent = "Getting GPS…";

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        capturedGeo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const { verification, distanceM } = verifyGeoForAgency(agencyId, capturedGeo.lat, capturedGeo.lng);
        banner.className = verification === "verified" ? "geo-banner ok" : "geo-banner bad";
        banner.textContent =
          verification === "verified"
            ? `Visit verified · ~${Math.round(distanceM)} m from agency (≤ ${TOLERANCE_M} m)`
            : `Location mismatch · ~${Math.round(distanceM)} m from agency`;
      },
      () => {
        banner.className = "geo-banner bad";
        banner.textContent = "Could not read GPS. Try outdoors or use “Simulate at agency”.";
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });

  document.getElementById("btn-simulate-agency").addEventListener("click", () => {
    const agencyId = document.getElementById("vn-agency").value;
    const ag = AGENCIES.find((x) => x.id === agencyId);
    const banner = document.getElementById("geo-status");
    if (!ag) return;
    capturedGeo = { lat: ag.lat + 0.0003, lng: ag.lng + 0.0003 };
    const { verification, distanceM } = verifyGeoForAgency(agencyId, capturedGeo.lat, capturedGeo.lng);
    banner.className = verification === "verified" ? "geo-banner ok" : "geo-banner bad";
    banner.textContent =
      verification === "verified"
        ? `Simulated near agency · ~${Math.round(distanceM)} m`
        : `Mismatch · ~${Math.round(distanceM)} m`;
  });

  document.getElementById("vn-selfie").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      capturedSelfie = r.result;
      document.getElementById("proof-preview-img").innerHTML = `<img src="${capturedSelfie}" alt="" />`;
    };
    r.readAsDataURL(f);
  });

  document.getElementById("vd-back").addEventListener("click", () => navigate("/visits"));

  document.getElementById("more-expenses").addEventListener("click", () => navigate("/expenses"));
  document.getElementById("more-prospects").addEventListener("click", () => navigate("/prospects"));
  document.getElementById("more-manager").addEventListener("click", () => navigate("/manager"));
  document.getElementById("more-admin").addEventListener("click", () => navigate("/admin"));
  document.getElementById("more-offline").addEventListener("click", () => {
    alert("Demo: offline queue would sync when online.");
  });

  document.getElementById("pro-back").addEventListener("click", () => navigate("/more"));
  document.getElementById("pro-save").addEventListener("click", () => {
    const sess = getSession();
    if (!["admin", "manager", "executive"].includes(sess.role)) {
      alert("You do not have permission to add prospects.");
      return;
    }
    const name = document.getElementById("pro-name").value.trim();
    const city = document.getElementById("pro-city").value.trim();
    const temp = document.getElementById("pro-temp").value;
    if (!name || !city) {
      alert("Enter name and city.");
      return;
    }
    const list = getProspects();
    list.unshift({
      id: crypto.randomUUID(),
      name,
      city,
      temp,
      createdBy: sess.name,
      ts: new Date().toISOString(),
    });
    saveProspects(list);
    document.getElementById("pro-name").value = "";
    document.getElementById("pro-city").value = "";
    document.getElementById("pro-temp").value = "warm";
    renderProspects();
  });

  document.getElementById("mgr-back").addEventListener("click", () => navigate("/more"));
  document.getElementById("mgr-assign").addEventListener("click", () => {
    if (!canManageTeam()) {
      alert("Only manager/admin can assign agencies.");
      return;
    }
    const staffId = document.getElementById("mgr-staff").value;
    const agencyId = document.getElementById("mgr-agency").value;
    const list = getAssignments();
    const updated = list.filter((x) => !(x.staffId === staffId && x.agencyId === agencyId));
    updated.unshift({
      id: crypto.randomUUID(),
      staffId,
      agencyId,
      createdBy: getSession().name,
      ts: new Date().toISOString(),
    });
    saveAssignments(updated);
    renderManager();
  });

  document.getElementById("exp-back").addEventListener("click", () => navigate("/more"));
  document.getElementById("exp-add").addEventListener("click", () => navigate("/expenses/new"));
  document.getElementById("en-cancel").addEventListener("click", () => navigate("/expenses"));
  document.getElementById("en-save").addEventListener("click", () => {
    const amount = document.getElementById("en-amount").value;
    const cat = document.getElementById("en-cat").value;
    if (!amount || Number(amount) <= 0) {
      alert("Enter amount.");
      return;
    }
    const ex = {
      id: crypto.randomUUID(),
      amount: Number(amount),
      category: cat,
      visitId: document.getElementById("en-visit").value || null,
      status: "pending",
      ts: new Date().toISOString(),
    };
    const list = getExpenses();
    list.unshift(ex);
    saveExpenses(list);
    navigate("/expenses");
  });

  document.getElementById("adm-back").addEventListener("click", () => navigate("/more"));
  document.getElementById("adm-filter-status").addEventListener("change", renderAdmin);
  document.getElementById("adm-filter-window").addEventListener("change", renderAdmin);

  window.addEventListener("hashchange", route);
  window.addEventListener("load", route);
})();
