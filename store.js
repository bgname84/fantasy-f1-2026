// ============================================================
//  STORE — capa de almacenamiento
//  La historia 2026 vive en data.js (igual para todos).
//  El "overlay" guarda SOLO los cambios nuevos (picks futuros,
//  resultados que captures, pagos). Puede persistir en:
//    - localStorage  (modo local, por defecto)
//    - Supabase      (modo compartido online)
// ============================================================
(function () {
  const SEED = window.SEASON_DATA;

  // ---- merge: SEED + overlay -> estado completo ----
  function buildState(overlay) {
    // deep-ish clone of seed parts we may override
    const picks = {};
    for (const r in SEED.picks) picks[r] = Object.assign({}, SEED.picks[r]);
    const results = {};
    for (const r in SEED.results) results[r] = Object.assign({}, SEED.results[r]);

    // apply overlay picks
    for (const r in (overlay.picks || {})) {
      picks[r] = picks[r] || {};
      for (const p in overlay.picks[r]) picks[r][p] = overlay.picks[r][p];
    }
    // apply overlay results
    for (const r in (overlay.results || {})) {
      results[r] = results[r] || {};
      for (const d in overlay.results[r]) {
        results[r][d] = Object.assign({}, results[r][d], overlay.results[r][d]);
      }
    }
    // race meta overrides (status/locked/sprint/driversRequired)
    const calendar = SEED.calendar.map(rc => {
      const m = (overlay.raceMeta || {})[rc.name];
      return m ? Object.assign({}, rc, m) : Object.assign({}, rc);
    });

    return {
      year: SEED.year,
      pointsSystem: SEED.pointsSystem,
      teams: SEED.teams,
      driverTeam: SEED.driverTeam,
      players: SEED.players,
      pagos: SEED.pagos,
      calendar,
      picks,
      results,
      payments: Object.assign({}, overlay.payments || {}),
    };
  }

  function emptyOverlay() {
    return { picks: {}, results: {}, raceMeta: {}, payments: {} };
  }

  // ---------------- Local adapter ----------------
  function LocalStore() {
    const KEY = "ff1_overlay_2026";
    let overlay = emptyOverlay();
    let listeners = [];
    function load() {
      try { overlay = Object.assign(emptyOverlay(), JSON.parse(localStorage.getItem(KEY) || "{}")); }
      catch (e) { overlay = emptyOverlay(); }
    }
    function save() { localStorage.setItem(KEY, JSON.stringify(overlay)); listeners.forEach(f => f()); }
    return {
      mode: "local",
      async init() { load(); },
      state() { return buildState(overlay); },
      onChange(f) { listeners.push(f); },
      async setPicks(race, player, drivers) {
        overlay.picks[race] = overlay.picks[race] || {};
        overlay.picks[race][player] = drivers; save();
      },
      async setResult(race, driver, data) {
        overlay.results[race] = overlay.results[race] || {};
        overlay.results[race][driver] = Object.assign({}, overlay.results[race][driver], data); save();
      },
      async clearResult(race, driver) {
        if (overlay.results[race]) { delete overlay.results[race][driver]; save(); }
      },
      async setRaceMeta(race, data) {
        overlay.raceMeta[race] = Object.assign({}, overlay.raceMeta[race], data); save();
      },
      async setPayment(player, data) {
        overlay.payments[player] = Object.assign({}, overlay.payments[player], data); save();
      },
      async resetAll() { overlay = emptyOverlay(); save(); },
    };
  }

  // ---------------- Supabase adapter ----------------
  function SupabaseStore(url, key) {
    let sb = null, overlay = emptyOverlay(), listeners = [];
    async function loadLib() {
      if (window.supabase) return;
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
        s.onload = res; s.onerror = rej; document.head.appendChild(s);
      });
    }
    async function pull() {
      const ov = emptyOverlay();
      const [pk, rs, rm, pm] = await Promise.all([
        sb.from("picks").select("*"),
        sb.from("results").select("*"),
        sb.from("race_meta").select("*"),
        sb.from("payments").select("*"),
      ]);
      (pk.data || []).forEach(r => { ov.picks[r.race] = ov.picks[r.race] || {}; ov.picks[r.race][r.player] = r.drivers; });
      (rs.data || []).forEach(r => { ov.results[r.race] = ov.results[r.race] || {}; ov.results[r.race][r.driver] = r.data; });
      (rm.data || []).forEach(r => { ov.raceMeta[r.race] = r.data; });
      (pm.data || []).forEach(r => { ov.payments[r.player] = r.data; });
      overlay = ov;
    }
    return {
      mode: "supabase",
      async init() {
        await loadLib();
        sb = window.supabase.createClient(url, key);
        await pull();
        const refresh = async () => { await pull(); listeners.forEach(f => f()); };
        ["picks", "results", "race_meta", "payments"].forEach(t =>
          sb.channel("rt_" + t).on("postgres_changes", { event: "*", schema: "public", table: t }, refresh).subscribe());
      },
      state() { return buildState(overlay); },
      onChange(f) { listeners.push(f); },
      async setPicks(race, player, drivers) {
        await sb.from("picks").upsert({ race, player, drivers }); await pull(); listeners.forEach(f => f());
      },
      async setResult(race, driver, data) {
        const cur = (overlay.results[race] || {})[driver] || {};
        await sb.from("results").upsert({ race, driver, data: Object.assign({}, cur, data) });
        await pull(); listeners.forEach(f => f());
      },
      async clearResult(race, driver) {
        await sb.from("results").delete().match({ race, driver }); await pull(); listeners.forEach(f => f());
      },
      async setRaceMeta(race, data) {
        const cur = overlay.raceMeta[race] || {};
        await sb.from("race_meta").upsert({ race, data: Object.assign({}, cur, data) });
        await pull(); listeners.forEach(f => f());
      },
      async setPayment(player, data) {
        const cur = overlay.payments[player] || {};
        await sb.from("payments").upsert({ player, data: Object.assign({}, cur, data) });
        await pull(); listeners.forEach(f => f());
      },
    };
  }

  const cfg = window.FF1_CONFIG || {};
  window.Store = (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY)
    ? SupabaseStore(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : LocalStore();
  window.Store.isShared = window.Store.mode === "supabase";
})();
