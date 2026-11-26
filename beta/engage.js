// ============================================================
//  BETA — MOTOR DE ENGANCHE
//  Todo se calcula en el navegador con los datos que YA existen
//  (data.js + Supabase). No crea tablas nuevas ni escribe nada.
//  Se carga DESPUES de app.js y reutiliza sus helpers globales.
// ============================================================
(function () {
  const MAXUSE = 4;

  // ============================================================
  //  INTERRUPTOR DE SOLO LECTURA (apagado por decisión del organizador)
  //  La beta comparte la MISMA base que la app estable, así que las
  //  selecciones se guardan una sola vez y se ven en las dos versiones.
  //  Si algún día quieres congelar la beta, pon READ_ONLY: true en
  //  config.js y esto bloquea toda escritura sin tocar la lectura.
  // ============================================================
  const RO = !!(window.FF1_CONFIG && window.FF1_CONFIG.READ_ONLY);
  if (RO && window.Store) {
    ["setPicks", "setResult", "setResultsBulk", "clearResult", "setRaceMeta", "setPayment"]
      .forEach(m => {
        if (typeof Store[m] !== "function") return;
        Store[m] = async function () {
          toast("🧪 La beta es de solo lectura — nada se guardó. Usa la versión estable.", "err");
          return false;
        };
      });
  }
                    // tope de usos por piloto en la temporada

  // ---------- utilidades base ----------
  const activeRaces = () => S.calendar.filter(r => r.status !== "cancelled");
  const hasResults  = r => !!(S.results[r.name] && Object.keys(S.results[r.name]).length);
  const ranRaces    = () => activeRaces().filter(hasResults);
  const pendRaces   = () => activeRaces().filter(r => !hasResults(r));
  const reqOf       = r => r.driversRequired || 0;
  const allDrivers  = () => S.teams.reduce((a, t) => a.concat(t.drivers), []);

  // promedio de puntos por carrera de cada piloto (solo carreras con resultado)
  const _avg = {};
  function drvAvg(d) {
    if (d in _avg) return _avg[d];
    let s = 0, n = 0;
    ranRaces().forEach(r => {
      const res = S.results[r.name] && S.results[r.name][d];
      if (res) { s += driverPoints(res); n++; }
    });
    return _avg[d] = n ? s / n : 0;
  }
  function clearCache() { for (const k in _avg) delete _avg[k]; _ph = null; }

  // ---------- cupos restantes y viabilidad ----------
  // Nota: el cupo restante se calcula con TODAS las selecciones, incluidas las de la
  // ronda abierta. Eso permite deducir los pilotos que ya mandó alguien restando contra
  // su historial; el organizador decidió que para esta liga eso no importa, y en cambio
  // hace que el veredicto de viabilidad sea exacto para todos.
  function remCap(code) {
    const out = {};
    allDrivers().forEach(d => { const u = usageCount(code, d); if (u < MAXUSE) out[d] = MAXUSE - u; });
    return out;
  }
  // ¿Puede cubrir legalmente lo que falta? Un piloto no se puede repetir en la
  // misma carrera, así que de cada piloto sólo sirven min(cupos, carreras) usos.
  // ¿Cuántos huecos puede llenar REALMENTE con el cupo que le queda?
  // No basta sumar usos: en una misma carrera no puede repetir piloto ni meter a
  // dos coequiperos, y puede traer carreras a medio llenar. Es un emparejamiento
  // pilotos→huecos, así que lo resolvemos con flujo máximo (grafo diminuto).
  function maxFill(cap, races, code) {
    const drv = Object.keys(cap), nD = drv.length, nR = races.length;
    if (!nD || !nR) return 0;
    const teamOfD = {}; S.teams.forEach(t => t.drivers.forEach(d => teamOfD[d] = t.name));
    const tn = []; drv.forEach(d => { if (tn.indexOf(teamOfD[d]) < 0) tn.push(teamOfD[d]); });
    const nT = tn.length;
    // capas: pilotos | (equipo,carrera) | carreras | fuente | sumidero
    const baseTR = nD, baseR = nD + nT * nR, SRC = baseR + nR, SNK = SRC + 1, N = SNK + 1;
    const c = Array.from({ length: N }, () => new Array(N).fill(0));
    drv.forEach((d, i) => { c[SRC][i] = cap[d]; });
    races.forEach((r, j) => {
      const have = picksOf(r.name, code);
      c[baseR + j][SNK] = Math.max(0, reqOf(r) - have.length);
      const usedTeams = have.map(x => teamOfD[x]);
      // cada equipo aporta como máximo UN piloto por carrera (regla de coequiperos)
      tn.forEach((t, k) => { c[baseTR + k * nR + j][baseR + j] = usedTeams.indexOf(t) >= 0 ? 0 : 1; });
      drv.forEach((d, i) => {
        if (have.indexOf(d) >= 0) return;                 // no se repite piloto en la misma carrera
        c[i][baseTR + tn.indexOf(teamOfD[d]) * nR + j] = 1;
      });
    });
    let flow = 0;
    for (;;) {                                   // Edmonds-Karp
      const prev = new Array(N).fill(-1); prev[SRC] = SRC;
      const q = [SRC];
      while (q.length) {
        const u = q.shift();
        for (let v = 0; v < N; v++) if (prev[v] < 0 && c[u][v] > 0) { prev[v] = u; q.push(v); }
      }
      if (prev[SNK] < 0) break;
      let aug = Infinity;
      for (let v = SNK; v !== SRC; v = prev[v]) aug = Math.min(aug, c[prev[v]][v]);
      for (let v = SNK; v !== SRC; v = prev[v]) { c[prev[v]][v] -= aug; c[v][prev[v]] += aug; }
      flow += aug;
    }
    return flow;
  }

  function feasibility(code) {
    // una carrera cuenta como pendiente si le faltan pilotos (incluye las guardadas a medias)
    const todo = pendRaces().filter(r => picksOf(r.name, code).length < reqOf(r));
    const R = todo.length;
    const need = todo.reduce((s, r) => s + (reqOf(r) - picksOf(r.name, code).length), 0);
    const cap = remCap(code);
    let slots = 0, distinct = 0;
    for (const d in cap) { slots += cap[d]; distinct++; }
    const usable = need ? maxFill(cap, todo, code) : 0;
    return {
      R, need, cap, slots, distinct, usable, todo,
      short: Math.max(0, need - usable),
      forced: need > 0 && slots === need && usable === need,
      slack: Math.max(0, slots - need),
    };
  }
  // multiset de pilotos obligados (los que forzosamente tendrá que alinear)
  function forcedPool(code) {
    const f = feasibility(code), out = [];
    for (const d in f.cap) for (let i = 0; i < Math.min(f.cap[d], Math.max(f.R, 1)); i++) out.push(d);
    return out.sort((a, b) => drvAvg(b) - drvAvg(a));
  }
  // proyección de puntos finales usando el promedio histórico de cada piloto
  function projection(code) {
    const f = feasibility(code);
    let pts = playerTotal(code);
    pendRaces().forEach(r => picksOf(r.name, code).forEach(d => pts += drvAvg(d)));
    forcedPool(code).slice(0, f.need).forEach(d => pts += drvAvg(d));
    return pts;
  }

  // ---------- rachas ----------
  function sentStreak(code) {                 // carreras seguidas (hacia atrás) con selección enviada
    const rs = ranRaces(); let n = 0;
    for (let i = rs.length - 1; i >= 0; i--) { if (picksOf(rs[i].name, code).length) n++; else break; }
    return n;
  }
  function missedRaces(code) { return ranRaces().filter(r => !picksOf(r.name, code).length); }
  function hotStreak(code) {                  // carreras seguidas por arriba del promedio de la liga
    const rs = ranRaces(); let n = 0;
    for (let i = rs.length - 1; i >= 0; i--) {
      const mine = playerRacePts(rs[i].name, code);
      const avg = S.players.reduce((s, p) => s + playerRacePts(rs[i].name, p.code), 0) / S.players.length;
      if (mine > avg) n++; else break;
    }
    return n;
  }

  // ---------- récords de temporada ----------
  function seasonRecords() {
    let bigRace = null, bigPick = null;
    const picked = {}, scoredBy = {};
    ranRaces().forEach(r => {
      S.players.forEach(p => {
        const v = playerRacePts(r.name, p.code);
        if (picksOf(r.name, p.code).length && (!bigRace || v > bigRace.pts)) bigRace = { code: p.code, race: r.name, pts: v };
        picksOf(r.name, p.code).forEach(d => { picked[d] = (picked[d] || 0) + 1; });
      });
      const R = S.results[r.name] || {};
      for (const d in R) {
        const v = driverPoints(R[d]);
        if (!bigPick || v > bigPick.pts) bigPick = { driver: d, race: r.name, pts: v };
      }
    });
    allDrivers().forEach(d => { scoredBy[d] = drvAvg(d); });
    const top = Object.entries(picked).sort((a, b) => b[1] - a[1]);
    const rent = Object.entries(scoredBy).sort((a, b) => b[1] - a[1]);
    return { bigRace, bigPick, mostPicked: top[0], leastPicked: top[top.length - 1], bestValue: rent[0] };
  }

  // ---------- duelo directo ----------
  function h2h(a, b) {
    let wa = 0, wb = 0, tie = 0;
    ranRaces().forEach(r => {
      const x = playerRacePts(r.name, a), y = playerRacePts(r.name, b);
      if (x > y) wa++; else if (y > x) wb++; else tie++;
    });
    return { wa, wb, tie };
  }

  // ---------- estadísticas personales ----------
  function myStats(code) {
    const rs = ranRaces().filter(r => picksOf(r.name, code).length);
    const vals = rs.map(r => ({ race: r.name, pts: playerRacePts(r.name, code) }));
    vals.sort((a, b) => b.pts - a.pts);
    const tot = playerTotal(code);
    const best = vals[0], worst = vals[vals.length - 1];
    const avg = vals.length ? tot / vals.length : 0;
    // piloto más rentable para él
    const byDrv = {};
    ranRaces().forEach(r => picksOf(r.name, code).forEach(d => {
      const v = driverPoints(S.results[r.name] && S.results[r.name][d]);
      byDrv[d] = byDrv[d] || { n: 0, s: 0 }; byDrv[d].n++; byDrv[d].s += v;
    }));
    const drvs = Object.entries(byDrv).map(([d, o]) => ({ d, n: o.n, s: o.s, a: o.s / o.n }));
    drvs.sort((a, b) => b.s - a.s);
    return { best, worst, avg, played: vals.length, drvs, total: tot };
  }

  // ---------- logros ----------
  function achievements(code) {
    const out = [];
    const rs = ranRaces();
    const played = rs.filter(r => picksOf(r.name, code).length).length;
    const miss = missedRaces(code).length;
    const st = myStats(code);
    // desc = requisito + tu progreso (nunca afirma algo que no lograste)
    const add = (on, icon, name, desc) => out.push({ on, icon, name, desc });
    const bp = st.best ? st.best.pts : 0;
    const strk = sentStreak(code);

    add(miss === 0, "🎯", "Asistencia perfecta",
      miss === 0 ? `Enviaste en las ${rs.length} carreras corridas` : `Te faltaron ${miss} de ${rs.length} carreras`);
    add(strk >= 5, "🔥", "En racha",
      strk >= 5 ? `${strk} carreras seguidas enviando a tiempo` : `Llevas ${strk}; necesitas 5 seguidas`);
    add(bp >= 40, "💥", "Carrerón",
      bp >= 40 ? `${bp} pts en una sola carrera (${st.best.race})` : `Tu máximo es ${bp}; necesitas 40`);
    add(bp >= 60, "🚀", "Carrera perfecta",
      bp >= 60 ? `${bp} pts en ${st.best.race}` : `Tu máximo es ${bp}; necesitas 60`);
    // ¿eligió al ganador alguna vez?
    let wins = 0, podios = 0, zeros = 0;
    rs.forEach(r => {
      const R = S.results[r.name] || {};
      const mine = picksOf(r.name, code);
      if (mine.some(d => R[d] && R[d].position === 1)) wins++;
      if (mine.some(d => R[d] && R[d].position <= 3)) podios++;
      if (mine.length && playerRacePts(r.name, code) === 0) zeros++;
    });
    add(wins >= 1, "🏆", "Ojo de ganador",
      wins >= 1 ? `Tuviste al ganador ${wins} ${wins === 1 ? "vez" : "veces"}` : "Nunca tuviste al ganador de la carrera");
    add(wins >= 8, "🔮", "Adivino",
      wins >= 8 ? `${wins} veces con el ganador` : `Llevas ${wins}; necesitas 8`);
    add(podios >= 15, "🥇", "Siempre arriba",
      podios >= 15 ? `${podios} carreras con alguien del podio` : `Llevas ${podios}; necesitas 15`);
    add(zeros === 0 && played > 0, "🛡️", "Nunca en blanco",
      zeros === 0 ? "Jamás te quedaste sin puntos" : `Te quedaste en 0 en ${zeros} carrera(s)`);
    const pl = standings().find(x => x.code === code);
    add(pl && pl.place <= 3, "👑", "Zona de premio",
      pl && pl.place <= 3 ? `Vas ${pl.place}º: zona de premio` : `Vas ${pl ? pl.place : "-"}º; el premio llega al 3º`);
    const f = feasibility(code);
    add(f.short === 0 && f.R > 0, "🧮", "Cuentas sanas",
      f.short === 0 ? "Tu cupo alcanza para cerrar la temporada" : `Te faltarán ${f.short} piloto(s) por cupo`);
    const hs = hotStreak(code);
    add(hs >= 3, "📈", "Caliente",
      hs >= 3 ? `${hs} carreras seguidas arriba del promedio` : `Llevas ${hs}; necesitas 3 seguidas`);
    return out;
  }

  // ---------- historial de POSICIÓN carrera a carrera ----------
  let _ph = null;
  function posHistory() {
    if (_ph) return _ph;
    const rs = ranRaces(), tot = {}, hist = {};
    S.players.forEach(p => { tot[p.code] = 0; hist[p.code] = []; });
    rs.forEach(r => {
      S.players.forEach(p => tot[p.code] += playerRacePts(r.name, p.code));
      S.players.map(p => ({ c: p.code, t: tot[p.code] }))
        .sort((a, b) => b.t - a.t)
        .forEach((o, i) => hist[o.c].push(i + 1));
    });
    return _ph = { races: rs.map(r => r.name), hist };
  }
  function moveLast(code) {                 // puestos ganados (+) o perdidos (-) en la última carrera
    const h = posHistory().hist[code] || [];
    return h.length < 2 ? 0 : h[h.length - 2] - h[h.length - 1];
  }

  // ---------- el cambio de un solo piloto que más te habría servido ----------
  function biggestRegret(code) {
    let best = null;
    ranRaces().forEach(r => {
      const R = S.results[r.name] || {}, mine = picksOf(r.name, code);
      if (!mine.length) return;
      mine.forEach(out => {
        const keep = mine.filter(x => x !== out);
        allDrivers().forEach(inn => {
          if (mine.indexOf(inn) >= 0) return;
          if (usageCount(code, inn) >= MAXUSE) return;              // no le quedaba cupo de ese piloto
          if (keep.some(k => teamOf(k) === teamOf(inn))) return;    // coequipero
          const gain = driverPoints(R[inn]) - driverPoints(R[out]);
          if (gain > 0 && (!best || gain > best.gain)) best = { race: r.name, out, inn, gain };
        });
      });
    });
    return best;
  }

  // ============================================================
  //  VISTAS
  // ============================================================
  function betaBar() {
    const d = el("div", "betabar");
    d.innerHTML = `<span>🧪 <b>Versión BETA</b> — misma base que la app normal: tus pilotos se guardan
      una sola vez y se ven en las dos versiones. Pruébala y dinos qué te parece.</span>
      <span class="spacer"></span><a href="../">← ir a la versión estable</a>`;
    return d;
  }

  function lightFor(f) {
    if (f.R === 0) return { cls: "done", txt: "Todo enviado", icon: "✅" };
    if (f.short > 0) return { cls: "locked", txt: `Sin salida: te faltarán ${f.short}`, icon: "⛔" };
    if (f.forced) return { cls: "sprint", txt: "Forzado: sin margen", icon: "🔒" };
    return { cls: "done", txt: `Con margen (+${f.slack})`, icon: "🟢" };
  }

  // --- tarjeta: EL CIERRE ESTÁ ESCRITO ---
  function closingCard(v) {
    const pend = pendRaces();
    if (!pend.length) return;
    const card = el("div", "card");
    card.appendChild(el("h2", null, "🔮 El cierre está escrito"));
    card.appendChild(el("div", "muted small",
      `Quedan ${pend.length} ${pend.length === 1 ? "carrera" : "carreras"} (${pend.map(r => esc(r.name)).join(", ")}). ` +
      `Como cada piloto se puede usar máximo ${MAXUSE} veces y los cupos de la temporada cuadran exacto, ` +
      `a estas alturas casi nadie puede elegir libremente: tus pilotos restantes ya están definidos.`));

    const st = standings();
    const showAll = !!ui.cierreAll;
    let base = showAll ? st.slice() : st.slice(0, 8);
    if (!showAll && user && !base.some(x => x.code === user)) {        // que siempre te veas
      const me = st.find(x => x.code === user); if (me) base.push(me);
    }
    const rows = base.map(r => ({ r, f: feasibility(r.code), proj: projection(r.code) }));
    const lead = st[0].total;
    const list = el("div", "cllist");
    rows.forEach(({ r, f, proj }) => {
      const pool = forcedPool(r.code);
      const lg = lightFor(f);
      const sent = pendRaces().filter(x => picksOf(x.name, r.code).length).map(x => x.name);
      const row = el("div", "clrow" + (r.code === user ? " me" : ""));
      row.innerHTML = `<div class="clhead">
          <span class="clpos">${r.place}</span>
          <span class="clname">${esc(r.name)}</span>
          <span class="clpts">${r.total}</span>
          <span class="cldif">${r.total === lead ? "—" : "-" + (lead - r.total)}</span>
        </div>
        <div class="clmeta">
          <span class="badge ${lg.cls}">${lg.icon} ${lg.txt}</span>
          ${sent.length ? `<span class="small muted">✔ ya envió ${sent.map(esc).join(", ")}</span>` : ""}
          <span class="spacer"></span>
          <span class="small muted">proyección <b>${Math.round(proj)}</b></span>
        </div>`;
      const g = el("div", "chips");
      if (pool.length) pool.forEach(d => {
        const c = el("span", "chip"); c.style.borderLeftColor = teamColor(teamOf(d));
        c.innerHTML = `${esc(dispLast(d))} <b>${drvAvg(d).toFixed(0)}</b>`;
        g.appendChild(c);
      });
      else g.appendChild(el("span", "small muted", "sin cupo libre"));
      row.appendChild(g);
      list.appendChild(row);
    });
    card.appendChild(list);
    const tog = el("button", "btn", showAll ? "Ver sólo el top 8" : `Ver los ${st.length} jugadores`);
    tog.onclick = () => { ui.cierreAll = !ui.cierreAll; render(); };
    card.appendChild(tog);
    card.appendChild(el("div", "small muted",
      "La proyección suma el promedio histórico de cada piloto que forzosamente tendrá que alinear. " +
      "No es una predicción: es el escenario si cada piloto rinde como su promedio de la temporada."));
    v.appendChild(card);
  }

  // --- tarjeta: MI SEMÁFORO (viabilidad personal) ---
  function myViabilityCard(v) {
    if (!user) return;
    const f = feasibility(user);
    if (!f.R && !f.short) return;
    const lg = lightFor(f);
    const card = el("div", "card");
    card.appendChild(el("h2", null, `${lg.icon} Tu cupo para cerrar la temporada`));
    const pool = Object.entries(f.cap).sort((a, b) => drvAvg(b[0]) - drvAvg(a[0]));
    let h = `<div class="statpills">
      <div class="statpill"><div class="k">Carreras por armar</div><div class="v">${f.R}</div></div>
      <div class="statpill"><div class="k">Pilotos que debes meter</div><div class="v">${f.need}</div></div>
      <div class="statpill"><div class="k">Usos disponibles</div><div class="v">${f.usable}</div></div>
      <div class="statpill"><div class="k">Estado</div><div class="v"><span class="badge ${lg.cls}">${lg.txt}</span></div></div>
    </div>`;
    card.innerHTML += h;
    if (f.short > 0) {
      card.appendChild(el("div", "warnbox",
        `⛔ <b>Ojo:</b> con los cupos que te quedan no alcanzas a llenar todas tus alineaciones: ` +
        `te quedarán <b>${f.short}</b> hueco(s) vacío(s) y esos pilotos valen 0 puntos. ` +
        `Sólo tienes ${f.distinct} piloto(s) distinto(s) con cupo y cada carrera pide pilotos diferentes. Avísale al organizador.`));
    } else if (f.forced) {
      card.appendChild(el("div", "warnbox",
        "🔒 Tus pilotos restantes ya están <b>determinados</b>: tienes exactamente los usos que necesitas. " +
        "Lo único que decides es en qué carrera pones a cada uno."));
    }
    if (pool.length) {
      const g = el("div", "chips");
      pool.forEach(([d, n]) => {
        const c = el("span", "chip");
        c.style.borderColor = teamColor(teamOf(d));
        c.innerHTML = `${esc(dispName(d))} <b>${n}</b> uso${n > 1 ? "s" : ""} <span class="muted">· ${drvAvg(d).toFixed(1)} pts/carrera</span>`;
        g.appendChild(c);
      });
      card.appendChild(el("div", "muted small", "Pilotos con cupo disponible:"));
      card.appendChild(g);
    }
    v.appendChild(card);
  }

  // --- tarjeta: MIS NÚMEROS ---
  function myStatsCard(v) {
    if (!user) return;
    const s = myStats(user), me = standings().find(x => x.code === user);
    const card = el("div", "card");
    card.appendChild(el("h2", null, "📊 Tus números"));
    card.innerHTML += `<div class="statpills">
      <div class="statpill"><div class="k">Posición</div><div class="v">${me.place}º <span class="small muted">de ${S.players.length}</span></div></div>
      <div class="statpill"><div class="k">Puntos</div><div class="v">${s.total}</div></div>
      <div class="statpill"><div class="k">Promedio</div><div class="v">${s.avg.toFixed(1)} <span class="small muted">/carrera</span></div></div>
      <div class="statpill"><div class="k">Tu mejor carrera</div><div class="v">${s.best ? s.best.pts : 0} <span class="small muted">${s.best ? esc(s.best.race) : ""}</span></div></div>
      <div class="statpill"><div class="k">Tu peor carrera</div><div class="v">${s.worst ? s.worst.pts : 0} <span class="small muted">${s.worst ? esc(s.worst.race) : ""}</span></div></div>
      <div class="statpill"><div class="k">Racha enviando</div><div class="v">${sentStreak(user)} 🔥</div></div>
      <div class="statpill"><div class="k">Racha caliente</div><div class="v">${hotStreak(user)} 📈<div class="small muted">arriba del promedio</div></div></div>
    </div>`;
    const miss = missedRaces(user);
    if (miss.length) {
      const perdidos = Math.round(s.avg * miss.length);
      card.appendChild(el("div", "warnbox",
        `😬 No enviaste selección en ${miss.length} carrera(s): <b>${miss.map(r => esc(r.name)).join(", ")}</b>. ` +
        `A tu propio promedio eso te costó cerca de <b>${perdidos} puntos</b>.`));
    }
    if (s.drvs.length) {
      card.appendChild(el("div", "muted small", "Tus pilotos más rentables:"));
      const g = el("div", "chips");
      s.drvs.slice(0, 6).forEach(o => {
        const c = el("span", "chip"); c.style.borderColor = teamColor(teamOf(o.d));
        c.innerHTML = `${esc(dispLast(o.d))} <b>${o.s}</b> pts <span class="muted">· ${o.n} usos</span>`;
        g.appendChild(c);
      });
      card.appendChild(g);
    }
    v.appendChild(card);
  }

  // --- tarjeta: DUELO DIRECTO ---
  function duelCard(v) {
    if (!user) return;
    const st = standings(), i = st.findIndex(x => x.code === user);
    if (i < 0) return;
    const rival = st[i - 1] || st[i + 1];
    if (!rival) return;
    const d = h2h(user, rival.code);
    const card = el("div", "card");
    card.appendChild(el("h2", null, "⚔️ Tu duelo directo"));
    const diff = Math.abs(st[i].total - rival.total);
    card.innerHTML += `<div class="duel">
      <div class="duelside"><div class="dname">${esc(playerName(user))}</div><div class="dpts">${st[i].total}</div></div>
      <div class="duelmid"><div class="dscore">${d.wa} — ${d.wb}</div><div class="small muted">carreras ganadas${d.tie ? ` · ${d.tie} empates` : ""}</div></div>
      <div class="duelside"><div class="dname">${esc(rival.name)}</div><div class="dpts">${rival.total}</div></div>
    </div>
    <div class="small muted" style="margin-top:8px">${st[i].total > rival.total
      ? `Le llevas <b>${diff}</b> puntos. No lo sueltes.`
      : `Estás <b>${diff}</b> puntos abajo. Es alcanzable.`}</div>`;
    v.appendChild(card);
  }

  // --- tarjeta: LOGROS ---
  function achievementsCard(v) {
    if (!user) return;
    const a = achievements(user);
    const got = a.filter(x => x.on).length;
    const card = el("div", "card");
    card.appendChild(el("h2", null, `🏅 Tus logros <span class="muted small">${got}/${a.length}</span>`));
    const g = el("div", "medals");
    a.forEach(x => {
      const m = el("div", "medal" + (x.on ? " on" : ""));
      m.innerHTML = `<div class="mi">${x.icon}</div><div class="mn">${esc(x.name)}</div><div class="md">${esc(x.desc)}</div>`;
      g.appendChild(m);
    });
    card.appendChild(g);
    v.appendChild(card);
  }

  // --- tarjeta: RÉCORDS DE LA TEMPORADA ---
  function recordsCard(v) {
    const r = seasonRecords();
    const card = el("div", "card");
    card.appendChild(el("h2", null, "📜 Récords de la temporada"));
    const pills = [];
    if (r.bigRace) pills.push(["Mejor carrera de alguien", `${r.bigRace.pts} pts`, `${playerName(r.bigRace.code)} · ${r.bigRace.race}`]);
    if (r.bigPick) pills.push(["Mejor piloto en una carrera", `${r.bigPick.pts} pts`, `${dispLast(r.bigPick.driver)} · ${r.bigPick.race}`]);
    if (r.mostPicked) pills.push(["El más elegido", `${r.mostPicked[1]} veces`, dispLast(r.mostPicked[0])]);
    if (r.bestValue) pills.push(["El más rentable", `${r.bestValue[1].toFixed(1)} pts`, `${dispLast(r.bestValue[0])} · por carrera`]);
    const lg = standings();
    pills.push(["Pelea por el título", `${lg[0].total - lg[1].total} pts`, `${lg[0].name.split(" ")[0]} vs ${lg[1].name.split(" ")[0]}`]);
    let h = '<div class="statpills">';
    pills.forEach(([k, val, sub]) => h += `<div class="statpill"><div class="k">${esc(k)}</div><div class="v">${esc(val)}</div><div class="small muted">${esc(sub)}</div></div>`);
    card.innerHTML += h + "</div>";
    v.appendChild(card);
  }

  // --- tarjeta: PENDIENTES (quién no ha enviado la próxima) ---
  function nudgeCard(v) {
    const open = pendRaces()[0];
    if (!open) return;
    const falta = S.players.filter(p => picksOf(open.name, p.code).length < reqOf(open));
    if (!falta.length) return;
    const card = el("div", "card");
    card.appendChild(el("h2", null, `⏰ Faltan ${falta.length} para ${esc(open.name)}`));
    const yo = falta.some(p => p.code === user);
    if (yo) card.appendChild(el("div", "warnbox", "👉 <b>Tú eres uno de ellos.</b> Ve a «Mi equipo» y manda tus pilotos antes del cierre."));
    const g = el("div", "chips");
    falta.forEach(p => {
      const c = el("span", "chip" + (p.code === user ? " me" : ""));
      c.textContent = p.fullName; g.appendChild(c);
    });
    card.appendChild(g);
    v.appendChild(card);
  }

  // --- tarjeta: LA PELEA POR LA PUNTA (gráfica de POSICIÓN) ---
  function positionCard(v) {
    const { races, hist } = posHistory();
    if (races.length < 3) return;
    const card = el("div", "card");
    card.appendChild(el("h2", null, "📉 La pelea por la punta"));
    // quién ha sido líder en cada carrera
    const leaders = [];
    races.forEach((rn, i) => {
      const who = S.players.find(p => hist[p.code][i] === 1);
      if (who && (!leaders.length || leaders[leaders.length - 1].code !== who.code))
        leaders.push({ code: who.code, from: rn, n: 1 });
      else if (leaders.length) leaders[leaders.length - 1].n++;
    });
    const distintos = leaders.filter((o, i, a) => a.findIndex(z => z.code === o.code) === i).length;
    const cambios = leaders.length - 1;
    card.appendChild(el("div", "muted small",
      `${distintos} ${distintos === 1 ? "líder" : "líderes distintos"} y ${cambios} ${cambios === 1 ? "cambio" : "cambios"} de liderato en ${races.length} carreras.` +
      (leaders.length ? ` Manda ${esc(shortName(leaders[leaders.length - 1].code))} desde ${esc(leaders[leaders.length - 1].from)}.` : "")));

    const W = 640, H = 220, PL = 26, PR = 10, PT = 12, PB = 22;
    const N = S.players.length;
    const x = i => PL + (W - PL - PR) * (races.length === 1 ? 0 : i / (races.length - 1));
    const y = p => PT + (H - PT - PB) * ((p - 1) / Math.max(1, N - 1));
    const who = [];
    const top3 = standings().slice(0, 3).map(r => r.code);
    top3.forEach(c => who.push(c));
    if (user && who.indexOf(user) < 0) who.push(user);
    const cols = ["#e10600", "#27F4D2", "#FF8000", "#8b5cf6"];
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="poschart" preserveAspectRatio="xMidYMid meet">`;
    [1, 7, 14, N].forEach(p => {
      svg += `<line x1="${PL}" y1="${y(p).toFixed(1)}" x2="${W - PR}" y2="${y(p).toFixed(1)}" stroke="#2a2e38"/>`;
      svg += `<text x="4" y="${(y(p) + 4).toFixed(1)}" fill="#7a8090" font-size="10">${p}º</text>`;
    });
    who.forEach((c, k) => {
      const pts = (hist[c] || []).map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
      svg += `<polyline points="${pts}" fill="none" stroke="${cols[k % cols.length]}" stroke-width="${c === user ? 3 : 2}" stroke-linejoin="round"/>`;
    });
    svg += `<text x="${PL}" y="${H - 6}" fill="#7a8090" font-size="10">${esc(races[0])}</text>`;
    svg += `<text x="${W - PR}" y="${H - 6}" fill="#7a8090" font-size="10" text-anchor="end">${esc(races[races.length - 1])}</text>`;
    svg += `</svg>`;
    card.innerHTML += svg;
    const leg = el("div", "chips");
    who.forEach((c, k) => {
      const ch = el("span", "chip"); ch.style.borderLeftColor = cols[k % cols.length];
      ch.innerHTML = `${esc(shortName(c))}${c === user ? " (tú)" : ""}`;
      leg.appendChild(ch);
    });
    card.appendChild(leg);

    // movimiento en la última carrera
    const movers = S.players.map(p => ({ p, m: moveLast(p.code) })).filter(o => o.m !== 0);
    movers.sort((a, b) => b.m - a.m);
    if (movers.length) {
      card.appendChild(el("div", "muted small", `Movimiento en ${esc(races[races.length - 1])}:`));
      const g = el("div", "chips");
      movers.slice(0, 5).concat(movers.slice(-3)).filter((o, i, a) => a.indexOf(o) === i).forEach(o => {
        const ch = el("span", "chip" + (o.p.code === user ? " me" : ""));
        ch.style.borderLeftColor = o.m > 0 ? "#2ed573" : "#ff4757";
        ch.innerHTML = `${esc(o.p.shortName)} <b>${o.m > 0 ? "▲" : "▼"}${Math.abs(o.m)}</b>`;
        g.appendChild(ch);
      });
      card.appendChild(g);
    }
    v.appendChild(card);
  }

  // --- tarjeta: LO QUE TE FALTÓ ---
  function regretCard(v) {
    if (!user) return;
    const st = standings(), i = st.findIndex(x => x.code === user);
    const card = el("div", "card");
    card.appendChild(el("h2", null, "😮‍💨 Lo que te faltó"));
    if (i > 0) {
      const up = st[i - 1];
      card.appendChild(el("div", null,
        `Te faltan <b>${up.total - st[i].total}</b> puntos para alcanzar a <b>${esc(up.name)}</b>.`));
    }
    const r = biggestRegret(user);
    if (r) {
      card.appendChild(el("div", "warnbox",
        `El cambio que más te habría servido: en <b>${esc(r.race)}</b>, poner a <b>${esc(dispLast(r.inn))}</b> ` +
        `en vez de <b>${esc(dispLast(r.out))}</b> te habría dado <b>+${r.gain}</b> puntos. ` +
        `(Tenías cupo de ${esc(dispLast(r.inn))} esa temporada.)`));
      const after = st[i].total + r.gain;
      const np = st.filter(z => z.total > after).length + 1;
      if (np < st[i].place) card.appendChild(el("div", "small muted",
        `Con esos puntos hoy irías ${np}º en vez de ${st[i].place}º.`));
    } else {
      card.appendChild(el("div", "small muted", "No encontramos ningún cambio de un solo piloto que te hubiera mejorado. Bien jugado."));
    }
    v.appendChild(card);
  }

  // --- compartir al grupo de WhatsApp ---
  function shareText() {
    const st = standings(), me = st.find(x => x.code === user);
    const rs = ranRaces(), last = rs[rs.length - 1];
    const mv = moveLast(user);
    const open = pendRaces()[0];
    const f = feasibility(user);
    const L = [];
    L.push(`🏁 FANTASY F1 2026 — ${playerName(user)}`);
    L.push(`${me.place}º de ${st.length} · ${me.total} pts${mv ? ` (${mv > 0 ? "▲" : "▼"}${Math.abs(mv)})` : ""}`);
    if (last) {
      // rejilla de la última carrera, sólo si ya cerró (no revela alineaciones abiertas)
      const mine = picksOf(last.name, user), R = S.results[last.name] || {};
      if (mine.length && isLockedForPlayers(last)) {
        const grid = mine.map(d => {
          const res = R[d]; if (!res) return "⬛";
          if (res.position === 1) return "🥇";
          if (res.position <= 3) return "🟩";
          return driverPoints(res) > 0 ? "🟨" : "⬛";
        }).join("");
        L.push(`${last.name}: ${grid} ${playerRacePts(last.name, user)} pts`);
      }
    }
    if (open) {
      const falta = S.players.filter(p => picksOf(open.name, p.code).length < reqOf(open)).length;
      L.push(`⏰ ${open.name}: faltan ${falta} de ${st.length} por enviar`);
      if (f.short > 0) L.push(`⛔ A mí me faltarán ${f.short} piloto(s) por cupo 😅`);
    }
    L.push("");
    L.push(location.href.replace(/\/beta\/?$/, "/"));
    return L.join("\n");
  }
  function shareCard(v) {
    if (!user) return;
    const card = el("div", "card");
    card.appendChild(el("h2", null, "📣 Presume en el grupo"));
    card.appendChild(el("div", "muted small", "Arma un resumen listo para pegar en el WhatsApp del concurso. No revela alineaciones de carreras abiertas."));
    const pre = el("pre", "sharebox"); pre.textContent = shareText();
    card.appendChild(pre);
    const row = el("div", "row");
    const b1 = el("button", "btn primary", "📋 Copiar");
    b1.onclick = async () => {
      try { await navigator.clipboard.writeText(shareText()); toast("Copiado ✔", "ok"); }
      catch (e) { toast("No se pudo copiar; selecciona el texto", "err"); }
    };
    const b2 = el("button", "btn", "💬 WhatsApp");
    b2.onclick = () => {
      const t = encodeURIComponent(shareText());
      if (navigator.share) navigator.share({ text: shareText() }).catch(() => window.open("https://wa.me/?text=" + t, "_blank"));
      else window.open("https://wa.me/?text=" + t, "_blank");
    };
    row.appendChild(b1); row.appendChild(b2);
    card.appendChild(row);
    v.appendChild(card);
  }

  // --- VISTA NUEVA: pestaña "Cierre" ---
  function viewStats(v) {
    clearCache();
    v.appendChild(betaBar());
    closingCard(v);
    myViabilityCard(v);
    nudgeCard(v);
    positionCard(v);
    duelCard(v);
    regretCard(v);
    myStatsCard(v);
    achievementsCard(v);
    recordsCard(v);
    shareCard(v);
  }

  // ---------- registro + parches sobre las vistas existentes ----------
  window.FF1_VIEWS = { stats: viewStats };

  const _tabla = window.viewTabla;
  window.viewTabla = function (v) {
    clearCache();
    v.appendChild(betaBar());
    _tabla(v);
    myViabilityCard(v);
    duelCard(v);
  };

  const _equipo = window.viewEquipo;
  window.viewEquipo = function (v) {
    clearCache();
    myViabilityCard(v);
    _equipo(v);
  };

  window.FF1_ENGAGE = { feasibility, forcedPool, projection, drvAvg, seasonRecords, achievements, myStats, h2h, sentStreak, posHistory, moveLast, biggestRegret, shareText };
})();
