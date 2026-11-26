#!/usr/bin/env python3
"""
Resincroniza la BETA con la version estable (../) y vuelve a aplicar
los cambios propios de la beta.

Uso:   /usr/bin/python3 beta/sync.py

Archivos propios de la beta (NO se tocan): engage.js, beta.css, sync.py
Todo lo demas se copia tal cual de la estable y se le aplican los parches
de abajo, para que la beta siempre sea la estable + lo nuevo.
"""
import json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
UP   = os.path.dirname(HERE)
COPY = ["app.js", "auth.js", "config.js", "data.js", "schedule.js",
        "store.js", "styles.css", "index.html", "manifest.json",
        "icon-192.png", "icon-512.png"]

def patch(path, pairs):
    p = os.path.join(HERE, path)
    s = open(p, encoding="utf-8").read()
    for old, new in pairs:
        if new in s:                      # ya aplicado
            continue
        if old not in s:
            sys.exit(f"ERROR en {path}: no encontre el ancla:\n  {old[:90]}")
        s = s.replace(old, new, 1)
    open(p, "w", encoding="utf-8").write(s)

for f in COPY:
    shutil.copy2(os.path.join(UP, f), os.path.join(HERE, f))
print("copiados", len(COPY), "archivos de la estable")

# 1) manifest propio para que la PWA no choque con la estable
mf = os.path.join(HERE, "manifest.json")
m = json.load(open(mf, encoding="utf-8"))
m["name"] = "Fantasy F1 2026 BETA"; m["short_name"] = "FF1 Beta"; m["theme_color"] = "#8b5cf6"
json.dump(m, open(mf, "w", encoding="utf-8"), indent=2, ensure_ascii=False)

# 2) index.html: titulo, distintivo, hoja de estilos, pestaña y script
patch("index.html", [
    ("<title>Fantasy F1 2026</title>", "<title>Fantasy F1 2026 — BETA</title>"),
    ('<div class="brand-sub">Temporada 2026</div>',
     '<div class="brand-sub">Temporada 2026 <span class="betatag">BETA</span></div>'),
    ('<link rel="stylesheet" href="styles.css">',
     '<link rel="stylesheet" href="styles.css">\n<link rel="stylesheet" href="beta.css">'),
    # "Cierre" va PRIMERO y es la pestaña que abre por defecto
    ('  <button data-tab="tabla" class="active"><span class="ti">🏆</span><span class="tl">Tabla</span></button>',
     '  <button data-tab="stats" class="active"><span class="ti">🔮</span><span class="tl">Cierre</span></button>\n'
     '  <button data-tab="tabla"><span class="ti">🏆</span><span class="tl">Tabla</span></button>'),
    ('<script src="app.js"></script>',
     '<script src="app.js"></script>\n<script src="engage.js"></script>'),
])

# 3) config.js: interruptor de solo lectura de la beta
patch("config.js", [
    ('  SEATS: {},\n};',
     '  SEATS: {},\n'
     '  // ---- BETA ----\n'
     '  // Las dos versiones usan la MISMA base, asi que una seleccion guardada aqui\n'
     '  // se ve igual en la estable. Pon true para congelar la beta (bloquea toda\n'
     '  // escritura sin tocar la lectura ni la sincronizacion en vivo).\n'
     '  READ_ONLY: false,\n};'),
])

# 4) app.js: despacho de vistas de la beta + pestaña inicial
patch("app.js", [
    ('let tab = "tabla";', 'let tab = "stats";   // la beta abre en "Cierre"'),
    ("  ({ tabla: viewTabla, equipo: viewEquipo, pilotos: viewPilotos, resultados: viewResultados, pagos: viewPagos }[tab])(v);",
     "  const VIEWS = Object.assign({ tabla: viewTabla, equipo: viewEquipo, pilotos: viewPilotos, resultados: viewResultados, pagos: viewPagos }, window.FF1_VIEWS || {});\n"
     "  (VIEWS[tab] || VIEWS.tabla)(v);"),
])
print("parches aplicados — beta sincronizada")
