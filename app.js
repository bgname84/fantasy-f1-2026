// ============================================================
//  FANTASY F1 2026 — lógica y vistas
// ============================================================
const Store = window.Store;
const CFG = window.FF1_CONFIG || {};
let S = null;            // estado actual (Store.state())
let user = localStorage.getItem("ff1_user") || null;     // código de jugador
let viewAsPlayer = localStorage.getItem("ff1_view_player") === "1"; // admin viendo como jugador
let admin = false;                                       // se calcula en render() según whitelist
const ADMINS = (window.FF1_CONFIG && window.FF1_CONFIG.ADMINS) || [];
const canBeAdmin = code => ADMINS.includes(code);
let tab = "tabla";
let ui = { equipoRace: null, equipoPlayer: null, resRace: null, pilotosAll: false };

const $ = (s, r = document) => r.querySelector(s);
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const PS = () => S.pointsSystem;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const lastName = n => { const p = String(n).trim().split(" "); return p[p.length - 1]; };
const teamOf = d => S.driverTeam[d];
// Colores oficiales de las escuderías 2026
const TEAM_COLORS = {
  "MERCEDES": "#27F4D2", "RED BULL": "#3671C6", "FERRARI": "#E8002D",
  "ASTON MARTIN": "#229971", "WILLIAMS": "#64C4FF", "MCLAREN": "#FF8000",
  "RACING BULLS": "#6692FF", "HAAS": "#B6BABD", "ALPINE": "#FF87BC",
  "AUDI": "#00A19B", "CADILLAC": "#C6A15B",
};
const teamColor = name => TEAM_COLORS[(name || "").toUpperCase()] || "#888";

// ---------- horarios / deadlines ----------
const SCHED = window.FF1_SCHEDULE || {};
const USERS = window.FF1_USERS || {};
function raceSprint(race) { const s = SCHED[race.name]; return (s && typeof s.sprint === "boolean") ? s.sprint : !!race.sprint; }
function raceDeadline(race) {
  if (race.deadline) return new Date(race.deadline);        // override del admin
  const iso = window.FF1_DEADLINE ? window.FF1_DEADLINE(race.name) : null;
  return iso ? new Date(iso) : null;
}
function raceTimes(race) { return SCHED[race.name] || {}; }
// CDMX (UTC-6, sin horario de verano) <-> input datetime-local / ISO UTC
function toCDMXInputValue(date) { return new Date(date.getTime() - 6 * 3600 * 1000).toISOString().slice(0, 16); }
function cdmxInputToUTCISO(val) { return new Date(val.slice(0, 16) + ":00-06:00").toISOString(); }

// ---------- cargar resultados oficiales (API Ergast/Jolpica) ----------
const normName = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\./g, "").trim();
const apiRaces = j => (j && j.MRData && j.MRData.RaceTable && j.MRData.RaceTable.Races) || [];
async function apiFetch(url, optional) {
  try { const r = await fetch(url); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
  catch (e) { if (optional) { console.warn("opcional falló", url, e); return null; } throw e; }
}
async function loadOfficialResults(race) {
  const round = raceTimes(race).apiRound;
  if (!round) { toast("Esta carrera no tiene ronda oficial.", "err"); return; }
  const base = `https://api.jolpi.ca/ergast/f1/2026/${round}`;
  const sprint = raceSprint(race);
  toast("Cargando resultados oficiales…");
  // results es obligatorio; quali y sprint son opcionales (si fallan, sus bonos/sprint quedan en 0)
  let rr, qq, ss;
  try {
    [rr, qq, ss] = await Promise.all([
      apiFetch(base + "/results.json?limit=100", false),
      apiFetch(base + "/qualifying.json?limit=100", true),
      sprint ? apiFetch(base + "/sprint.json?limit=100", true) : Promise.resolve(null),
    ]);
  } catch (e) { console.error(e); toast("La API de F1 respondió con error. Intenta de nuevo en un momento.", "err"); return; }
  const rRace = apiRaces(rr)[0];
  if (!rRace || !rRace.Results) { toast("Aún no hay resultados oficiales de esta carrera.", "err"); return; }
  try {
    // mapas piloto<->equipo desde nuestro roster
    const sur2name = {}, teammate = {};
    S.teams.forEach(tm => {
      tm.drivers.forEach(d => sur2name[normName(d.split(" ").pop())] = d);
      if (tm.drivers.length === 2) { teammate[tm.drivers[0]] = tm.drivers[1]; teammate[tm.drivers[1]] = tm.drivers[0]; }
    });
    const nameOf = e => sur2name[normName(e.Driver.familyName)];
    const qpos = {}, rpos = {}, posText = {}, spos = {};
    rRace.Results.forEach(r => { const n = nameOf(r); if (!n) return; rpos[n] = +r.position; posText[n] = r.positionText; });
    ((apiRaces(qq)[0] || {}).QualifyingResults || []).forEach(q => { const n = nameOf(q); if (n) qpos[n] = +q.position; });
    if (sprint) ((apiRaces(ss)[0] || {}).SprintResults || []).forEach(s => { const n = nameOf(s); if (n) spos[n] = +s.position; });
    const finished = n => /^\d+$/.test(posText[n]);   // clasificado como finalizador
    // construir resultados. Bonos SOLO si el coequipero del roster participó (no sustituto/ausente).
    // rBonus solo si el piloto terminó la carrera (no premia doble-DNF). DOTD lo pone el admin.
    const entries = Object.keys(rpos).map(n => {
      const tm = teammate[n];
      const tmRaced = tm && (tm in rpos);
      const qB = (n in qpos && tmRaced && (!(tm in qpos) || qpos[n] < qpos[tm])) ? 1 : 0;
      const rB = (finished(n) && tmRaced && rpos[n] < rpos[tm]) ? 1 : 0;
      return { driver: n, data: { position: finished(n) ? +posText[n] : "DNF", sprintPos: sprint ? (spos[n] || 0) : 0, qBonus: qB, rBonus: rB } };
    });
    await Store.setResultsBulk(race.name, entries);
    toast(`✔ Cargados ${entries.length} pilotos · revisa DOTD y bonos`, "ok");
    render();
  } catch (e) { console.error(e); toast("Error procesando los resultados.", "err"); }
}

// ---------- exportar a Excel (admin), parecido al archivo original ----------
async function loadXLSX() {
  if (window.XLSX) return;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
}
async function exportResultsExcel() {
  toast("Generando Excel…");
  try {
    await loadXLSX();
    const XLSX = window.XLSX;
    const players = S.players;
    const scored = scoredRaces();
    const scoredSet = new Set(scored.map(r => r.name));
    const place = {}; standings().forEach(r => place[r.code] = r.place);
    const wb = XLSX.utils.book_new();

    // 1) Hoja "Puntos" (matriz carreras x jugadores, como el original)
    const m = [["", ...players.map(p => p.shortName)]];
    S.calendar.filter(r => r.status !== "cancelled").forEach(r => {
      m.push([r.name, ...players.map(p => scoredSet.has(r.name) ? (playerRacePts(r.name, p.code) || 0) : "")]);
    });
    m.push([]);
    m.push(["TOTAL", ...players.map(p => playerTotal(p.code))]);
    m.push(["Lugar", ...players.map(p => place[p.code])]);
    const wsP = XLSX.utils.aoa_to_sheet(m);
    wsP["!cols"] = [{ wch: 14 }, ...players.map(() => ({ wch: 7 }))];
    wsP["!freeze"] = { xSplit: 1, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsP, "Puntos");

    // 2) Hoja "Detalle por jugador" (pilotos elegidos y puntos por carrera)
    const det = [["Jugador", "Carrera", "Pilotos elegidos (pts c/u)", "Pts carrera"]];
    players.forEach(p => {
      scored.forEach(r => {
        const pk = picksOf(r.name, p.code);
        if (!pk.length) return;
        det.push([p.fullName, r.name,
          pk.map(d => `${d} (${driverPoints(S.results[r.name] && S.results[r.name][d])})`).join(", "),
          playerRacePts(r.name, p.code) || 0]);
      });
    });
    const wsD = XLSX.utils.aoa_to_sheet(det);
    wsD["!cols"] = [{ wch: 26 }, { wch: 13 }, { wch: 60 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsD, "Detalle por jugador");

    // 3) Hoja "Resultados oficiales" (por carrera, cada piloto)
    const off = [["Carrera", "Piloto", "Equipo", "Pos", "Pts carrera", "Sprint", "Q", "R", "DOTD", "Total"]];
    scored.forEach(r => {
      const res = S.results[r.name] || {};
      Object.keys(res).sort((a, b) => driverPoints(res[b]) - driverPoints(res[a])).forEach(d => {
        const x = res[d];
        off.push([r.name, d, teamOf(d) || "", x.position, racePts(x.position), sprintPts(x.sprintPos),
          x.qBonus ? 1 : 0, x.rBonus ? 1 : 0, x.otd ? 1 : 0, driverPoints(x)]);
      });
    });
    const wsO = XLSX.utils.aoa_to_sheet(off);
    wsO["!cols"] = [{ wch: 13 }, { wch: 20 }, { wch: 14 }, { wch: 6 }, { wch: 10 }, { wch: 7 }, { wch: 4 }, { wch: 4 }, { wch: 5 }, { wch: 7 }];
    XLSX.utils.book_append_sheet(wb, wsO, "Resultados oficiales");

    XLSX.writeFile(wb, `Fantasy F1 2026 - Resultados (${scored.length} carreras).xlsx`);
    toast("Excel descargado ✔", "ok");
  } catch (e) { console.error(e); toast("No se pudo generar el Excel (revisa tu conexión).", "err"); }
}

function isLockedForPlayers(race) {
  if (race.status === "cancelled" || race.status === "done") return true;
  const dl = raceDeadline(race);
  return dl ? (Date.now() >= dl.getTime()) : false;
}
function nextOpenRace() {
  return S.calendar.find(r => r.status === "upcoming" && !isLockedForPlayers(r));
}
function fmtCDMX(d) {
  if (!d) return "—";
  return d.toLocaleString("es-MX", { timeZone: "America/Mexico_City", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtCountdown(ms) {
  if (ms <= 0) return "INSCRIPCIÓN CERRADA";
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`;
  return `${m}m ${String(ss).padStart(2, "0")}s`;
}
function countdownBanner() {
  const card = el("div", "cdbanner");
  const r = nextOpenRace();
  if (!r) {
    const up = S.calendar.find(x => x.status === "upcoming");
    card.innerHTML = up
      ? `<div class="cdlabel">PRÓXIMA CARRERA</div><div class="cdrace">R${up.round} · ${esc(up.name)}</div><div class="cdwhen err">⏱️ Inscripción cerrada — solo el administrador puede modificar.</div>`
      : `<div class="cdrace">🏁 Temporada finalizada</div>`;
    return card;
  }
  const dl = raceDeadline(r), t = raceTimes(r);
  card.innerHTML = `<div class="cdrow">
    <div><div class="cdlabel">PRÓXIMA CARRERA · CIERRE DE INSCRIPCIÓN</div>
      <div class="cdrace">R${r.round} · ${esc(r.name)} ${raceSprint(r) ? '<span class="badge sprint">SPRINT</span>' : ""}</div>
      <div class="cdwhen">Cierra antes de la ${raceSprint(r) ? "Clasificación Sprint" : "Clasificación"}: <b>${esc(fmtCDMX(dl))}</b> (CDMX)</div>
      ${t.race ? `<div class="cdwhen muted">Carrera: ${esc(fmtCDMX(new Date(t.race)))} (CDMX)</div>` : ""}</div>
    <div class="cdtimer"><span data-deadline="${dl ? dl.toISOString() : ""}">—</span></div></div>`;
  return card;
}
function updateCountdowns() {
  let needRender = false;
  document.querySelectorAll("[data-deadline]").forEach(elm => {
    const v = elm.getAttribute("data-deadline"); if (!v) return;
    const ms = new Date(v).getTime() - Date.now();
    elm.textContent = fmtCountdown(ms);
    elm.classList.toggle("err", ms <= 0);
    if (ms <= 0 && !elm.dataset.closed) { elm.dataset.closed = "1"; needRender = true; }
  });
  if (needRender) render();
}
const playerName = code => { const p = S.players.find(x => x.code === code); return p ? p.fullName : code; };
const shortName = code => { const p = S.players.find(x => x.code === code); return p ? p.shortName : code; };

// ---------- puntos ----------
function racePts(pos) { return (typeof pos === "number") ? (PS().race[pos] || 0) : 0; }
function sprintPts(spos) { return (typeof spos === "number") ? (PS().sprint[spos] || 0) : 0; }
function driverPoints(res) {
  if (!res) return 0;
  return racePts(res.position) + sprintPts(res.sprintPos) +
    (res.qBonus ? 1 : 0) + (res.rBonus ? 1 : 0) + (res.otd ? 1 : 0);
}
function picksOf(race, code) { return (S.picks[race] && S.picks[race][code]) || []; }
function playerRacePts(race, code) {
  return picksOf(race, code).reduce((s, d) => s + driverPoints(S.results[race] && S.results[race][d]), 0);
}
function playerTotal(code) {
  return S.calendar.reduce((s, r) => s + (r.status === "cancelled" ? 0 : playerRacePts(r.name, code)), 0);
}
function usageCount(code, driver, exceptRace) {
  let n = 0;
  for (const r of S.calendar) {
    if (r.status === "cancelled" || r.name === exceptRace) continue;
    if (picksOf(r.name, code).includes(driver)) n++;
  }
  return n;
}
function doneRaces() { return S.calendar.filter(r => r.status === "done"); }
function editableRaces() { return S.calendar.filter(r => r.status === "upcoming"); }
// carreras con puntos: cerradas o con algún resultado ya capturado
function scoredRaces() {
  return S.calendar.filter(r => r.status !== "cancelled" &&
    (r.status === "done" || (S.results[r.name] && Object.keys(S.results[r.name]).length)));
}

// ---------- standings ----------
function standings() {
  const rows = S.players.map(p => ({ code: p.code, name: p.fullName, total: playerTotal(p.code) }));
  rows.sort((a, b) => b.total - a.total);
  let place = 0, prev = null;
  rows.forEach((r, i) => { if (r.total !== prev) { place = i + 1; prev = r.total; } r.place = place; });
  return rows;
}
function prizes() {
  const paid = S.players.filter(p => (S.payments[p.code] || {}).paid).length;
  const entry = S.pagos.entry;
  const pot = paid > 0 ? paid * entry : S.pagos.pot;
  return { pot, p1: Math.round(pot * .6), p2: Math.round(pot * .3), p3: Math.round(pot * .1), paid };
}
const money = n => "$" + Number(n).toLocaleString("es-MX");

// ============================================================
//  RENDER
// ============================================================
function render() {
  S = Store.state();
  if (user && !S.players.some(p => p.code === user)) {   // jugador removido por un admin → cerrar sesión
    localStorage.removeItem("ff1_user"); user = null;
    viewAsPlayer = false; localStorage.removeItem("ff1_view_player");
  }
  admin = !!user && canBeAdmin(user) && !viewAsPlayer;   // admin automático por whitelist
  renderWho();
  const v = $("#view"); v.innerHTML = "";
  if (!user) { showLogin(); return; }
  $("#loginModal").hidden = true;   // garantiza ocultar el modal cuando ya hay usuario
  ({ tabla: viewTabla, equipo: viewEquipo, pilotos: viewPilotos, resultados: viewResultados, pagos: viewPagos }[tab])(v);
}

function renderWho() {
  const w = $("#whoBox");
  if (!user) { w.innerHTML = ""; return; }
  const isAdminUser = canBeAdmin(user);
  w.innerHTML = `Eres <b>${esc(playerName(user))}</b>${admin ? ' <span class="badge done">ADMIN</span>' : ""}
    <a id="myPass">🔑 mi clave</a>
    <a id="changeUser">cambiar</a>${isAdminUser ? ` <a id="adminToggle">${viewAsPlayer ? "🔧 volver a admin" : "👁️ ver como jugador"}</a>` : ""}`;
  $("#myPass").onclick = () => changeOwnPassword();
  $("#changeUser").onclick = () => {
    localStorage.removeItem("ff1_user"); user = null;
    viewAsPlayer = false; localStorage.removeItem("ff1_view_player"); render();
  };
  const at = $("#adminToggle");
  if (at) at.onclick = () => {
    viewAsPlayer = !viewAsPlayer;
    localStorage.setItem("ff1_view_player", viewAsPlayer ? "1" : "0");
    toast(viewAsPlayer ? "Viendo como jugador" : "Modo admin", "ok"); render();
  };
}

// ---------- TABLA ----------
function viewTabla(v) {
  const rows = standings(), pz = prizes();
  v.appendChild(countdownBanner());
  v.appendChild(el("h2", "section", `🏆 Tabla general · ${scoredRaces().length} carreras corridas`));

  // podio
  const pod = el("div", "podium");
  const order = [rows[1], rows[0], rows[2]];
  const cls = ["p2", "p1", "p3"], pr = [pz.p2, pz.p1, pz.p3], lbl = ["2°", "1°", "3°"];
  order.forEach((r, i) => {
    if (!r) return;
    const c = el("div", "pod " + cls[i]);
    c.innerHTML = `<div class="pos">${lbl[i]} lugar</div><div class="nm">${esc(r.name)}</div>
      <div class="pts">${r.total}</div><div class="prize">${money(pr[i])}</div>`;
    pod.appendChild(c);
  });
  v.appendChild(pod);

  // tabla detallada por carrera
  const done = scoredRaces();
  const card = el("div", "card");
  const wrap = el("div", "matrix");
  let h = '<table class="standings"><thead><tr><th>#</th><th>Jugador</th>';
  done.forEach(r => h += `<th class="num race-col" title="${esc(r.name)}">R${r.round}${raceSprint(r) ? "ⓢ" : ""}</th>`);
  h += '<th class="num">TOTAL</th></tr></thead><tbody>';
  rows.forEach(r => {
    const me = r.code === user ? " me" : "";
    h += `<tr class="${me.trim()}"><td><span class="rank ${r.place <= 3 ? "r" + r.place : ""}">${r.place}</span></td><td>${esc(r.name)}</td>`;
    done.forEach(rc => h += `<td class="num race-col">${playerRacePts(rc.name, r.code) || ""}</td>`);
    h += `<td class="num"><b>${r.total}</b></td></tr>`;
  });
  h += "</tbody></table>";
  wrap.innerHTML = h; card.appendChild(wrap);   // wrap = .matrix: scroll en escritorio, ajustado en móvil
  card.appendChild(el("div", "legend", '<span>ⓢ = carrera sprint</span><span>Premios: 60% / 30% / 10% del bote</span>'));
  v.appendChild(card);
}

// ---------- MI EQUIPO ----------
function viewEquipo(v) {
  const targetPlayer = (admin && ui.equipoPlayer) ? ui.equipoPlayer : user;
  ui.equipoPlayer = targetPlayer;

  v.appendChild(countdownBanner());
  v.appendChild(el("h2", "section", "🏎️ Mi equipo"));

  // selectores
  const bar = el("div", "card");
  const rowEl = el("div", "row");
  if (admin) {
    const ps = el("select", "sel");
    S.players.forEach(p => ps.innerHTML += `<option value="${p.code}" ${p.code === targetPlayer ? "selected" : ""}>${esc(p.fullName)}</option>`);
    ps.onchange = () => { ui.equipoPlayer = ps.value; render(); };
    rowEl.appendChild(wrapLabel("Jugador (admin)", ps));
  }
  // race selector: editable + (admin) all
  const races = admin ? S.calendar.filter(r => r.status !== "cancelled") : editableRaces();
  if (!ui.equipoRace || !races.find(r => r.name === ui.equipoRace)) ui.equipoRace = races[0] && races[0].name;
  const rs = el("select", "sel");
  races.forEach(r => rs.innerHTML += `<option value="${r.name}" ${r.name === ui.equipoRace ? "selected" : ""}>R${r.round} · ${esc(r.name)}${raceSprint(r) ? " (sprint)" : ""} · ${isLockedForPlayers(r) ? "cerrada" : "abierta"}</option>`);
  rs.onchange = () => { ui.equipoRace = rs.value; render(); };
  rowEl.appendChild(wrapLabel("Carrera", rs));
  bar.appendChild(rowEl);
  v.appendChild(bar);

  const race = S.calendar.find(r => r.name === ui.equipoRace);
  if (!race) { v.appendChild(el("div", "notice", "No hay carreras abiertas para elegir pilotos.")); return showHistory(v, targetPlayer); }

  const locked = isLockedForPlayers(race);
  const canEdit = admin || !locked;
  const req = race.driversRequired || 3;
  const dl = raceDeadline(race);
  let pending = picksOf(race.name, targetPlayer).slice();

  const info = el("div", "card");
  const estado = race.status === "done" ? "CERRADA (corrida)" : locked ? "INSCRIPCIÓN CERRADA" : "ABIERTA";
  info.innerHTML = `<div class="row"><div><b>R${race.round} · ${esc(race.name)}</b>
     <span class="badge ${raceSprint(race) ? "sprint" : "upcoming"}">${raceSprint(race) ? "SPRINT" : "normal"}</span>
     <span class="badge ${locked ? "locked" : "done"}">${estado}</span></div>
     <div class="spacer"></div><div class="muted">Elegir <b>${req}</b> pilotos · sin compañeros · máx 4 carreras por piloto</div></div>
     ${dl ? `<div class="small" style="margin-top:8px">Cierre de inscripción: <b>${esc(fmtCDMX(dl))}</b> (CDMX)
        ${!locked ? `· cierra en <b data-deadline="${dl.toISOString()}">—</b>` : `· <span class="err">cerrada</span>`}</div>` : ""}
     ${locked && admin ? `<div class="small warn" style="margin-top:6px">Inscripción cerrada para jugadores — editas como ADMIN.</div>` : ""}`;
  v.appendChild(info);

  const grid = el("div", "teamgrid");
  function redraw() {
    grid.innerHTML = "";
    const pendingTeams = new Set(pending.map(teamOf));
    S.teams.forEach(t => {
      const tc = el("div", "teamcard");
      tc.style.setProperty("--tc", teamColor(t.name));
      tc.appendChild(el("div", "tname", esc(t.name)));
      t.drivers.forEach(d => {
        const used = usageCount(targetPlayer, d, race.name);
        const isPicked = pending.includes(d);
        const teammatePicked = !isPicked && t.drivers.some(o => o !== d && pending.includes(o));
        const maxed = !isPicked && used >= 4;
        const full = !isPicked && pending.length >= req;
        const disabled = !canEdit || teammatePicked || maxed || (full && !isPicked);
        const row = el("div", "drv" + (isPicked ? " picked" : "") + (disabled ? " disabled" : ""));
        const pips = [0, 1, 2, 3].map(i => `<span class="pip ${i < used ? (used >= 4 ? "full" : "used") : ""}"></span>`).join("");
        row.innerHTML = `<div><div class="dn">${esc(d)}</div><div class="small muted">${used}/4 usadas${teammatePicked ? " · compañero elegido" : maxed ? " · sin cupo" : ""}</div></div><div class="pips">${pips}</div>`;
        if (!disabled) row.onclick = () => {
          if (isPicked) pending = pending.filter(x => x !== d);
          else if (pending.length < req) pending.push(d);
          redraw(); updateBar();
        };
        tc.appendChild(row);
      });
      grid.appendChild(tc);
    });
  }
  const actions = el("div", "card");
  function updateBar() {
    const ok = pending.length === req;
    actions.innerHTML = `<div class="row"><div>Seleccionados: <b>${pending.length}/${req}</b>
      ${pending.length ? "· " + pending.map(esc).join(", ") : ""}</div><div class="spacer"></div></div>`;
    if (canEdit) {
      const save = el("button", "btn primary", "Guardar selección");
      save.disabled = !ok;
      save.onclick = async () => {
        await Store.setPicks(race.name, targetPlayer, pending);
        toast("Selección guardada ✔", "ok");
      };
      actions.querySelector(".row").appendChild(save);
      if (!ok) actions.appendChild(el("div", "small warn", `Debes elegir exactamente ${req} pilotos.`));
    } else {
      actions.appendChild(el("div", "small muted", "⏱️ Inscripción cerrada — ya no puedes modificar tus pilotos. Solo el administrador puede hacer cambios."));
    }
  }
  redraw(); v.appendChild(grid);
  updateBar(); v.appendChild(actions);
  showHistory(v, targetPlayer);
}

function showHistory(v, code) {
  const card = el("div", "card");
  card.appendChild(el("h2", "section", "Historial de " + esc(playerName(code))));
  let h = '<table class="hist"><thead><tr><th>Carrera</th><th>Pilotos</th><th class="num">Pts</th></tr></thead><tbody>';
  S.calendar.filter(r => r.status !== "cancelled").forEach(r => {
    const pk = picksOf(r.name, code);
    if (!pk.length && r.status !== "done") return;
    const det = pk.map(d => `${esc(d)} <span class="muted">(${driverPoints(S.results[r.name] && S.results[r.name][d])})</span>`).join(", ");
    h += `<tr><td>R${r.round} ${esc(r.name)}</td><td>${det || '<span class="muted">—</span>'}</td><td class="num">${playerRacePts(r.name, code) || 0}</td></tr>`;
  });
  h += `</tbody><tfoot><tr><th>TOTAL</th><th></th><th class="num">${playerTotal(code)}</th></tr></tfoot></table>`;
  card.innerHTML += h; v.appendChild(card);
}

// ---------- PILOTOS ----------
function viewPilotos(v) {
  v.appendChild(el("h2", "section", "📊 Disponibilidad de pilotos"));
  // mis disponibilidades
  const mine = el("div", "card");
  mine.appendChild(el("div", "muted small", "Tus usos por piloto (máx 4 por temporada)"));
  const grid = el("div", "teamgrid");
  S.teams.forEach(t => {
    const tc = el("div", "teamcard"); tc.style.setProperty("--tc", teamColor(t.name));
    tc.appendChild(el("div", "tname", esc(t.name)));
    t.drivers.forEach(d => {
      const used = usageCount(user, d);
      const pips = [0, 1, 2, 3].map(i => `<span class="pip ${i < used ? (used >= 4 ? "full" : "used") : ""}"></span>`).join("");
      tc.appendChild(el("div", "drv", `<div><div class="dn">${esc(d)}</div><div class="small ${used >= 4 ? "warn" : "muted"}">${4 - used} disponibles</div></div><div class="pips">${pips}</div>`));
    });
    grid.appendChild(tc);
  });
  mine.appendChild(grid); v.appendChild(mine);

  // matriz completa
  const card = el("div", "card");
  const head = el("div", "row");
  head.innerHTML = `<b>Matriz completa (todos los jugadores)</b><div class="spacer"></div>`;
  const tg = el("button", "btn", ui.pilotosAll ? "Ocultar" : "Mostrar");
  tg.onclick = () => { ui.pilotosAll = !ui.pilotosAll; render(); };
  head.appendChild(tg); card.appendChild(head);
  if (ui.pilotosAll) {
    const allDrivers = S.teams.flatMap(t => t.drivers);
    const wrap = el("div", "matrix");
    let h = '<table><thead><tr><th>Jugador</th>';
    allDrivers.forEach(d => h += `<th class="c" title="${esc(d)}">${esc(lastName(d).slice(0, 3))}</th>`);
    h += "</tr></thead><tbody>";
    S.players.forEach(p => {
      h += `<tr class="${p.code === user ? "me" : ""}"><td>${esc(p.shortName)}</td>`;
      allDrivers.forEach(d => { const u = usageCount(p.code, d); h += `<td class="c c${u}">${u || ""}</td>`; });
      h += "</tr>";
    });
    h += "</tbody></table>"; wrap.innerHTML = h; card.appendChild(wrap);
  }
  v.appendChild(card);
}

// ---------- RESULTADOS (admin) ----------
function viewResultados(v) {
  v.appendChild(el("h2", "section", "🧮 Resultados de carrera"));
  if (!admin) {
    v.appendChild(el("div", "notice", "La captura es solo del organizador. Aquí puedes consultar los resultados (solo lectura)."));
    resultsReadOnly(v);
    consultaSection(v);
    return;
  }

  const races = S.calendar.filter(r => r.status !== "cancelled");
  if (!ui.resRace || !races.find(r => r.name === ui.resRace)) ui.resRace = (editableRaces()[0] || races[0]).name;
  const bar = el("div", "card"); const row = el("div", "row");
  const rs = el("select", "sel");
  races.forEach(r => rs.innerHTML += `<option value="${r.name}" ${r.name === ui.resRace ? "selected" : ""}>R${r.round} · ${esc(r.name)} · ${r.status}</option>`);
  rs.onchange = () => { ui.resRace = rs.value; render(); };
  row.appendChild(wrapLabel("Carrera", rs));
  const race = S.calendar.find(r => r.name === ui.resRace);

  // formato (desde horarios oficiales, solo lectura) + pilotos a elegir
  const fmt = el("div", "pill", raceSprint(race) ? "🅂 SPRINT" : "Normal");
  row.appendChild(wrapLabel("Formato", fmt));
  const dr = el("select", "sel");[3, 4].forEach(n => dr.innerHTML += `<option ${race.driversRequired === n ? "selected" : ""}>${n}</option>`);
  dr.onchange = () => Store.setRaceMeta(race.name, { driversRequired: +dr.value }).then(() => toast("Actualizado", "ok"));
  row.appendChild(wrapLabel("Pilotos a elegir", dr));
  bar.appendChild(row);

  // horario / cierre de inscripción
  const dl = raceDeadline(race), t = raceTimes(race);
  const sched = el("div", "small muted");
  sched.style.marginTop = "10px";
  sched.innerHTML = `🕒 Cierre de inscripción: <b>${esc(fmtCDMX(dl))}</b> (CDMX) · ${isLockedForPlayers(race) ? '<span class="err">cerrada para jugadores</span>' : '<span class="ok">abierta</span>'}${t.race ? ` · Carrera: ${esc(fmtCDMX(new Date(t.race)))}` : ""}${race.deadline ? ' · <span class="warn">cierre personalizado</span>' : ""}`;
  bar.appendChild(sched);

  // editar cierre de inscripción (admin)
  const dlEdit = el("div", "row"); dlEdit.style.marginTop = "8px";
  const dlInput = el("input"); dlInput.type = "datetime-local"; dlInput.className = "input"; dlInput.style.maxWidth = "220px";
  if (dl) dlInput.value = toCDMXInputValue(dl);
  const saveDl = el("button", "btn", "Guardar cierre");
  saveDl.onclick = () => {
    if (!dlInput.value) { toast("Pon fecha y hora", "err"); return; }
    Store.setRaceMeta(race.name, { deadline: cdmxInputToUTCISO(dlInput.value) }).then(() => { toast("Cierre actualizado", "ok"); render(); });
  };
  const resetDl = el("button", "btn", "Restaurar oficial");
  resetDl.onclick = () => Store.setRaceMeta(race.name, { deadline: null }).then(() => { toast("Cierre oficial restaurado", "ok"); render(); });
  dlEdit.appendChild(wrapLabel("Editar cierre (hora CDMX)", dlInput));
  dlEdit.appendChild(saveDl); dlEdit.appendChild(resetDl);
  bar.appendChild(dlEdit);

  const lockRow = el("div", "row"); lockRow.style.marginTop = "10px";
  const lockBtn = el("button", "btn " + (race.status === "done" ? "" : "primary"), race.status === "done" ? "🔓 Reabrir carrera" : "🔒 Cerrar carrera (oficial)");
  lockBtn.onclick = () => Store.setRaceMeta(race.name, { status: race.status === "done" ? "upcoming" : "done" }).then(render);
  lockRow.appendChild(lockBtn);
  lockRow.appendChild(el("div", "small muted", "Cerrar = resultados oficiales; congela la tabla. (Los jugadores ya están bloqueados desde la clasificación)."));
  bar.appendChild(lockRow);

  // exportar a Excel (admin)
  const expRow = el("div", "row"); expRow.style.marginTop = "10px";
  const expBtn = el("button", "btn", "📊 Exportar tablas a Excel");
  expBtn.onclick = () => exportResultsExcel();
  expRow.appendChild(expBtn);
  expRow.appendChild(el("div", "small muted", "Descarga un Excel con la tabla de Puntos, el detalle por jugador y los resultados oficiales por carrera (estilo del archivo original)."));
  bar.appendChild(expRow);
  v.appendChild(bar);

  // which drivers to show: picked by anyone (+ optional all)
  const picked = new Set();
  Object.values(S.picks[race.name] || {}).forEach(arr => arr.forEach(d => picked.add(d)));
  const allDrivers = S.teams.flatMap(t => t.drivers);
  const show = ui.resAll ? allDrivers : allDrivers.filter(d => picked.has(d));

  const card = el("div", "card");
  const hd = el("div", "row");
  hd.innerHTML = `<b>Captura por piloto</b> <span class="muted small">(${picked.size} pilotos elegidos por jugadores)</span><div class="spacer"></div>`;
  const loadBtn = el("button", "btn primary", "⬇️ Cargar resultados oficiales");
  loadBtn.onclick = () => loadOfficialResults(race);
  const tgl = el("button", "btn", ui.resAll ? "Solo elegidos" : "Mostrar los 22");
  tgl.onclick = () => { ui.resAll = !ui.resAll; render(); };
  hd.appendChild(loadBtn); hd.appendChild(tgl); card.appendChild(hd);
  card.appendChild(el("div", "small muted", "“Cargar resultados oficiales” trae posiciones, sprint y bonos de coequipero desde la F1 (re-ejecutable si hay cambios). El <b>Driver of the Day</b> y cualquier ajuste se ponen a mano abajo."));

  if (!show.length) { card.appendChild(el("div", "notice", "Aún nadie eligió pilotos para esta carrera.")); v.appendChild(card); consultaSection(v); return; }

  const sprint = raceSprint(race);
  const wrap = el("div", "matrix");
  const tbl = el("table", "capture");
  tbl.innerHTML = `<thead><tr><th>Piloto</th><th>Pos</th>${sprint ? "<th>Sprint</th>" : ""}<th>Q✓</th><th>R✓</th><th>DOTD</th><th class="num">Pts</th></tr></thead>`;
  const tb = el("tbody");
  show.forEach(d => {
    const res = (S.results[race.name] && S.results[race.name][d]) || {};
    const tr = el("tr");
    const posI = `<input class="input" style="width:64px" value="${res.position != null ? res.position : ""}" placeholder="1-20/DNF">`;
    const spI = sprint ? `<input class="input" style="width:54px" value="${res.sprintPos || ""}" placeholder="-">` : "";
    const q = `<input type="checkbox" ${res.qBonus ? "checked" : ""}>`;
    const r = `<input type="checkbox" ${res.rBonus ? "checked" : ""}>`;
    const dotd = `<input type="radio" name="dotd_${race.name}" ${res.otd ? "checked" : ""}>`;
    tr.innerHTML = `<td><span class="tdot" style="background:${teamColor(teamOf(d))}"></span><b>${esc(lastName(d))}</b> <span class="small tm" style="color:${teamColor(teamOf(d))}">${esc(teamOf(d) || "")}</span></td>
      <td>${posI}</td>${sprint ? `<td>${spI}</td>` : ""}<td>${q}</td><td>${r}</td><td>${dotd}</td><td class="num pts-${cssId(d)}">${driverPoints(res)}</td>`;
    const [posInp, spInp] = tr.querySelectorAll("input.input");
    const [qC, rC] = tr.querySelectorAll('input[type=checkbox]');
    const dotdR = tr.querySelector('input[type=radio]');
    const collect = () => {
      let pos = posInp.value.trim();
      if (pos === "") pos = null; else if (/^\d+$/.test(pos)) pos = parseInt(pos); else pos = pos.toUpperCase();
      const data = { position: pos, sprintPos: sprint && spInp ? (parseInt(spInp.value) || 0) : 0, qBonus: qC.checked ? 1 : 0, rBonus: rC.checked ? 1 : 0 };
      return data;
    };
    const saveDriver = async (extra) => {
      const data = Object.assign(collect(), extra || {});
      await Store.setResult(race.name, d, data);
      toast("Guardado " + lastName(d), "ok");
    };
    posInp.onchange = () => saveDriver();
    if (spInp) spInp.onchange = () => saveDriver();
    qC.onchange = () => saveDriver();
    rC.onchange = () => saveDriver();
    dotdR.onchange = async () => {
      // clear otd on others, set on this
      for (const od of show) if (od !== d) await Store.setResult(race.name, od, { otd: 0 });
      await saveDriver({ otd: 1 });
      render();
    };
    tb.appendChild(tr);
  });
  tbl.appendChild(tb); wrap.appendChild(tbl); card.appendChild(wrap);
  card.appendChild(el("div", "legend", '<span>Pos = posición final (número, o DNF/DNS/DSQ)</span><span>Q✓ = calificó mejor que su compañero</span><span>R✓ = le ganó en carrera</span><span>DOTD = Driver of the Day</span>'));
  v.appendChild(card);
  consultaSection(v);
}
function cssId(s) { return String(s).replace(/[^a-z0-9]/gi, ""); }

// ---------- consulta de resultados de cualquier jugador (solo lectura) ----------
function consultaSection(v) {
  const card = el("div", "card");
  card.appendChild(el("h2", "section", "📋 Consultar resultados de jugadores"));
  const code = (ui.consultaPlayer && S.players.find(p => p.code === ui.consultaPlayer)) ? ui.consultaPlayer : user;
  const sel = el("select", "sel");
  S.players.forEach(p => sel.innerHTML += `<option value="${p.code}" ${p.code === code ? "selected" : ""}>${esc(p.fullName)}</option>`);
  sel.onchange = () => { ui.consultaPlayer = sel.value; render(); };
  const bar = el("div", "row");
  bar.appendChild(wrapLabel("Ver jugador", sel));
  bar.appendChild(el("div", "small muted", "Solo lectura · desglose por piloto"));
  card.appendChild(bar);

  const scored = scoredRaces();
  const chk = x => x ? "✓" : "";
  let h = '<table class="capture breakdown"><thead><tr><th>Piloto</th><th>Pos</th><th>Spr</th><th>Q</th><th>R</th><th>DOTD</th><th class="num">Pts</th></tr></thead><tbody>';
  let grand = 0, any = false;
  scored.forEach(r => {
    const pk = picksOf(r.name, code);
    if (!pk.length) return;
    any = true;
    const rp = playerRacePts(r.name, code) || 0; grand += rp;
    h += `<tr class="grp"><td colspan="6">R${r.round} · ${esc(r.name)}${raceSprint(r) ? " (sprint)" : ""}</td><td class="num">${rp}</td></tr>`;
    pk.forEach(d => {
      const x = (S.results[r.name] && S.results[r.name][d]) || {};
      h += `<tr><td><span class="tdot" style="background:${teamColor(teamOf(d))}"></span>${esc(lastName(d))} <span class="small tm" style="color:${teamColor(teamOf(d))}">${esc(teamOf(d) || "")}</span></td>`
        + `<td>${x.position != null ? esc(String(x.position)) : ""}</td>`
        + `<td>${sprintPts(x.sprintPos) || ""}</td>`
        + `<td class="ok">${chk(x.qBonus)}</td><td class="ok">${chk(x.rBonus)}</td><td style="color:var(--gold)">${chk(x.otd)}</td>`
        + `<td class="num"><b>${driverPoints(x)}</b></td></tr>`;
    });
  });
  h += `</tbody><tfoot><tr><th colspan="6">TOTAL</th><th class="num">${grand}</th></tr></tfoot></table>`;
  if (!any) h = '<div class="notice">Este jugador aún no tiene resultados en carreras corridas.</div>';
  const wrap = el("div", "matrix"); wrap.innerHTML = h; card.appendChild(wrap);
  v.appendChild(card);
}

// ---------- desglose por piloto de una carrera (solo lectura, para jugadores) ----------
function resultsReadOnly(v) {
  const scored = scoredRaces();
  if (!scored.length) { v.appendChild(el("div", "notice", "Aún no hay resultados de ninguna carrera.")); return; }
  const card = el("div", "card");
  card.appendChild(el("h2", "section", "🏁 Puntos por piloto (por carrera)"));
  if (!ui.resViewRace || !scored.find(r => r.name === ui.resViewRace)) ui.resViewRace = scored[scored.length - 1].name;
  const sel = el("select", "sel");
  scored.forEach(r => sel.innerHTML += `<option value="${r.name}" ${r.name === ui.resViewRace ? "selected" : ""}>R${r.round} · ${esc(r.name)}${raceSprint(r) ? " (sprint)" : ""}</option>`);
  sel.onchange = () => { ui.resViewRace = sel.value; render(); };
  const bar = el("div", "row"); bar.appendChild(wrapLabel("Carrera", sel));
  bar.appendChild(el("div", "small muted", "Solo lectura"));
  card.appendChild(bar);

  const race = scored.find(r => r.name === ui.resViewRace);
  const sprint = raceSprint(race);
  const res = S.results[race.name] || {};
  const drivers = Object.keys(res).sort((a, b) => driverPoints(res[b]) - driverPoints(res[a]));
  const chk = x => x ? "✓" : "";
  let h = `<table class="capture"><thead><tr><th>Piloto</th><th>Pos</th>${sprint ? "<th>Spr</th>" : ""}<th>Q</th><th>R</th><th>DOTD</th><th class="num">Pts</th></tr></thead><tbody>`;
  drivers.forEach(d => {
    const x = res[d];
    h += `<tr><td><span class="tdot" style="background:${teamColor(teamOf(d))}"></span><b>${esc(lastName(d))}</b> <span class="small tm" style="color:${teamColor(teamOf(d))}">${esc(teamOf(d) || "")}</span></td>`
      + `<td>${x.position != null ? esc(String(x.position)) : ""}</td>`
      + (sprint ? `<td>${x.sprintPos || ""}</td>` : "")
      + `<td class="ok">${chk(x.qBonus)}</td><td class="ok">${chk(x.rBonus)}</td><td style="color:var(--gold)">${chk(x.otd)}</td>`
      + `<td class="num"><b>${driverPoints(x)}</b></td></tr>`;
  });
  h += "</tbody></table>";
  const wrap = el("div", "matrix"); wrap.innerHTML = h; card.appendChild(wrap);
  card.appendChild(el("div", "legend", '<span>Pos = posición final</span><span>Q = calificó mejor que su compañero</span><span>R = le ganó en carrera</span><span>DOTD = Driver of the Day</span>'));
  v.appendChild(card);
}

// ---------- PAGOS ----------
function viewPagos(v) {
  v.appendChild(el("h2", "section", "💵 Pagos y premios"));
  const pz = prizes();
  const sum = el("div", "card");
  sum.innerHTML = `<div class="row">
    <div class="pill">Bote: <b>${money(pz.pot)}</b></div>
    <div class="pill">Pagados: <b>${pz.paid}/${S.players.length}</b></div>
    <div class="pill" style="border-color:var(--gold)">1° ${money(pz.p1)}</div>
    <div class="pill" style="border-color:var(--silver)">2° ${money(pz.p2)}</div>
    <div class="pill" style="border-color:var(--bronze)">3° ${money(pz.p3)}</div></div>`;
  v.appendChild(sum);

  const card = el("div", "card");
  let h = '<table><thead><tr><th>#</th><th>Jugador</th><th>Cuota</th><th>Estado</th></tr></thead><tbody>';
  S.players.forEach((p, i) => {
    const pay = S.payments[p.code] || {};
    h += `<tr class="${p.code === user ? "me" : ""}"><td>${i + 1}</td><td>${esc(p.fullName)}</td><td>${money(S.pagos.entry)}</td>
      <td data-pay="${p.code}">${pay.paid ? '<span class="ok">✔ Pagado</span>' : '<span class="muted">Pendiente</span>'}</td></tr>`;
  });
  h += "</tbody></table>"; card.innerHTML = h;
  if (admin) {
    card.querySelectorAll("[data-pay]").forEach(td => {
      td.style.cursor = "pointer";
      td.onclick = () => { const c = td.getAttribute("data-pay"); const cur = (S.payments[c] || {}).paid; Store.setPayment(c, { paid: !cur }).then(render); };
    });
    card.appendChild(el("div", "small muted", "Toca el estado para marcar pagado/pendiente (admin)."));
  }
  v.appendChild(card);

  if (admin) viewGestionParticipantes(v);
}

// ---------- gestión de participantes (admin) ----------
function viewGestionParticipantes(v) {
  const card = el("div", "card");
  card.appendChild(el("h2", "section", "👥 Gestión de participantes"));

  // agregar
  const addBar = el("div", "row");
  const nameI = el("input", "input"); nameI.placeholder = "Nombre completo";
  const passI = el("input", "input"); passI.placeholder = "Clave de acceso";
  const addBtn = el("button", "btn primary", "➕ Agregar");
  addBtn.onclick = async () => {
    const name = nameI.value.trim(), pass = passI.value.trim();
    if (name.length < 2) { toast("Escribe el nombre", "err"); return; }
    if (pass.length < 3) { toast("La clave debe tener al menos 3 caracteres", "err"); return; }
    const code = genCode(name);
    await saveRosterEdit(code, { added: true, active: true, fullName: name, shortName: name.split(" ")[0], password: pass });
    toast("Participante agregado ✔", "ok"); nameI.value = ""; passI.value = ""; render();
  };
  addBar.appendChild(wrapLabel("Nuevo participante", nameI));
  addBar.appendChild(wrapLabel("Clave", passI));
  addBar.appendChild(addBtn);
  card.appendChild(addBar);

  // lista (incluye removidos para poder restaurar)
  const seedAll = window.SEASON_DATA.players || [];
  const addedCodes = Object.keys(S.rosterEdits).filter(c => S.rosterEdits[c].added && !seedAll.some(p => p.code === c));
  const allCodes = [...seedAll.map(p => p.code), ...addedCodes];
  const tbl = el("table", "hist");
  tbl.innerHTML = '<thead><tr><th>Jugador</th><th>Clave</th><th>Acción</th></tr></thead>';
  const tb = el("tbody");
  allCodes.forEach(code => {
    const e = S.rosterEdits[code] || {};
    const seedP = seedAll.find(p => p.code === code);
    const name = e.fullName || (seedP ? seedP.fullName : code);
    const active = e.active !== false;
    const clave = (S.creds || {})[code] || e.password || "—";
    const tr = el("tr");
    const nameTd = el("td"); nameTd.innerHTML = active ? esc(name) : `<span style="text-decoration:line-through;opacity:.5">${esc(name)}</span> <span class="small err">removido</span>`;
    const claveTd = el("td"); claveTd.innerHTML = `<code style="font-size:13px">${esc(String(clave))}</code>`;
    const actTd = el("td");
    const chBtn = el("button", "btn", "✏️"); chBtn.title = "Cambiar clave"; chBtn.onclick = () => adminChangePass(code, name);
    actTd.appendChild(chBtn);
    if (canBeAdmin(code)) {
      const lbl = el("span", "small muted", " admin"); actTd.appendChild(lbl);
    } else {
      const rmBtn = el("button", "btn"); rmBtn.style.marginLeft = "6px";
      rmBtn.textContent = active ? "🗑️ quitar" : "♻️ restaurar";
      rmBtn.onclick = async () => { await saveRosterEdit(code, { active: !active }); toast(active ? "Participante removido" : "Restaurado", "ok"); render(); };
      actTd.appendChild(rmBtn);
    }
    tr.appendChild(nameTd); tr.appendChild(claveTd); tr.appendChild(actTd);
    tb.appendChild(tr);
  });
  tbl.appendChild(tb);
  const wrap = el("div", "matrix"); wrap.appendChild(tbl); card.appendChild(wrap);
  card.appendChild(el("div", "small muted", "Cambia la clave de cualquiera, agrega o quita participantes. Los administradores no se pueden quitar."));
  v.appendChild(card);
}

// ---------- helpers UI ----------
function wrapLabel(label, node) { const w = el("div", "field"); w.appendChild(el("div", "small muted", label)); w.appendChild(node); return w; }
function toast(msg, kind) { const t = $("#toast"); t.textContent = msg; t.className = "toast " + (kind || ""); t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2200); }

// ---------- cuentas / roster ----------
function miniModal(title, nodes) {
  const bg = el("div", "modal-bg");
  const box = el("div", "modal");
  box.appendChild(el("h2", null, esc(title)));
  nodes.forEach(n => box.appendChild(n));
  const close = el("button", "btn block", "Cerrar");
  close.onclick = () => bg.remove();
  box.appendChild(close);
  bg.appendChild(box);
  bg.onclick = e => { if (e.target === bg) bg.remove(); };
  document.body.appendChild(bg);
  return bg;
}
async function saveRosterEdit(code, patch) {
  const edits = Object.assign({}, S.rosterEdits);
  edits[code] = Object.assign({}, edits[code], patch);
  await Store.setRaceMeta("__roster__", { edits });
}
function genCode(name) {
  const used = new Set([...(window.SEASON_DATA.players || []).map(p => p.code), ...Object.keys(S.creds || {}), ...Object.keys(S.rosterEdits || {})]);
  const base = ((name || "P").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3)) || "P";
  let i = 1, code; do { code = base + i; i++; } while (used.has(code));
  return code;
}
function changeOwnPassword() {
  const inp1 = el("input", "input"); inp1.type = "text"; inp1.placeholder = "Nueva clave"; inp1.autocomplete = "off";
  const inp2 = el("input", "input"); inp2.type = "text"; inp2.placeholder = "Repite la nueva clave"; inp2.autocomplete = "off"; inp2.style.marginTop = "8px";
  const err = el("div", "small err"); err.style.marginTop = "6px";
  const save = el("button", "btn primary block", "Guardar clave");
  const info = el("p", "muted small", `Tu clave actual: <b>${esc(String((S.creds || {})[user] || "—"))}</b>. Pon la que quieras (mínimo 3 caracteres).`);
  const bg = miniModal("🔑 Cambiar mi clave", [info, inp1, inp2, err, save]);
  save.onclick = async () => {
    const a = inp1.value.trim(), b = inp2.value.trim();
    if (a.length < 3) { err.textContent = "La clave debe tener al menos 3 caracteres."; return; }
    if (a !== b) { err.textContent = "Las claves no coinciden."; return; }
    await saveRosterEdit(user, { password: a });
    toast("Clave actualizada ✔", "ok"); bg.remove();
  };
}
function adminChangePass(code, name) {
  const inp = el("input", "input"); inp.type = "text"; inp.placeholder = "Nueva clave"; inp.value = String((S.creds || {})[code] || "");
  const err = el("div", "small err"); err.style.marginTop = "6px";
  const save = el("button", "btn primary block", "Guardar clave");
  const bg = miniModal(`🔑 Clave de ${name}`, [inp, err, save]);
  save.onclick = async () => {
    const a = inp.value.trim();
    if (a.length < 3) { err.textContent = "Mínimo 3 caracteres."; return; }
    await saveRosterEdit(code, { password: a });
    toast("Clave actualizada ✔", "ok"); bg.remove();
  };
}

function showLogin() {
  const m = $("#loginModal"); m.hidden = false;
  const sel = $("#loginSelect"); sel.innerHTML = "";
  S.players.forEach(p => sel.innerHTML += `<option value="${p.code}">${esc(p.fullName)}</option>`);
  const creds = S.creds || {};
  const needPass = Object.keys(creds).length > 0;
  const tryLogin = () => {
    const code = sel.value;
    const pass = ($("#loginPass").value || "").trim().toUpperCase();
    if (needPass && (!creds[code] || String(creds[code]).toUpperCase() !== pass)) {
      $("#loginErr").textContent = "Clave incorrecta para ese jugador.";
      return;
    }
    user = code; localStorage.setItem("ff1_user", user); $("#loginErr").textContent = ""; m.hidden = true; render();
  };
  $("#loginBtn").onclick = tryLogin;
  $("#loginPass").onkeydown = e => { if (e.key === "Enter") tryLogin(); };
}

// ---------- init ----------
$("#tabs").querySelectorAll("button").forEach(b => b.onclick = () => {
  tab = b.dataset.tab;
  $("#tabs").querySelectorAll("button").forEach(x => x.classList.toggle("active", x === b));
  render();
});
Store.onChange(() => render());
setInterval(updateCountdowns, 1000);
(async function () {
  try { await Store.init(); }
  catch (e) { console.error(e); toast("Error de conexión, usando modo local", "err"); }
  render();
  if (Store.isShared) toast("Conectado en modo compartido ✔", "ok");
})();
