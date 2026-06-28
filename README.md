# 🏁 Fantasy F1 2026

App web para gestionar el concurso de Fantasy F1. Reemplaza el control manual del Excel:
calculas los puntos **una sola vez** (capturas resultados) y la app calcula automáticamente
los puntos de los 28 jugadores, valida las reglas, actualiza el ranking y la disponibilidad
de pilotos.

Hecha con HTML/JS puro — **sin instalar nada**. Toda la historia 2026 (Australia → Barcelona)
ya viene importada y verificada contra tu Excel original.

---

## Qué hace

- **⏱️ Contador** — un cronómetro en vivo marca cuánto falta para el **cierre de inscripción**
  de la próxima carrera (antes de la Clasificación, o de la Clasificación Sprint en fines de
  semana sprint). Horarios oficiales F1 2026 incluidos, mostrados en hora de CDMX.
- **🔒 Bloqueo automático** — al pasar la hora de cierre, los jugadores **ya no pueden** tocar
  sus pilotos; solo el administrador puede hacer cambios.
- **🔑 Acceso por jugador** — cada quien entra con su **nombre + código** y solo puede editar
  **sus** pilotos (ver `CREDENCIALES.md`).
- **🏆 Tabla** — ranking general, podio con premios (60/30/10%) y desglose por carrera.
- **🏎️ Mi equipo** — cada jugador elige sus pilotos para la próxima carrera. La app:
  - bloquea **compañeros de equipo** en la misma carrera,
  - bloquea pilotos con **4 usos** ya gastados (límite de temporada),
  - exige el número exacto de pilotos (3 o 4 según la carrera),
  - muestra los usos restantes de cada piloto con puntitos.
- **📊 Pilotos** — tu disponibilidad por piloto + matriz de todos los jugadores.
- **🧮 Resultados** *(admin)* — capturas posición, sprint, Driver of the Day y bonos por
  piloto. Los puntos se calculan solos con el sistema oficial F1. Cierras la carrera y los
  jugadores ya no pueden cambiar sus picks.
- **💵 Pagos** — control de cuotas y cálculo del bote y premios.

---

## Reglas que aplica (del reglamento)

- 3 o 4 pilotos por carrera, anunciado por el organizador.
- No se pueden elegir compañeros de equipo en la misma carrera.
- Máximo 4 carreras por piloto en toda la temporada.
- Puntos = puntaje oficial F1 por posición (+ sprint) más bonos:
  - +1 si calificó mejor que su compañero,
  - +1 si le ganó en carrera,
  - +1 si fue Driver of the Day.

---

## Acceso (usuarios y códigos)

- Cada jugador entra eligiendo **su nombre** + el **código** que le corresponde.
  La lista completa está en `CREDENCIALES.md` — repártela en privado por el chat.
- El **administrador** (tú) entra con cualquier nombre y luego pulsa **🔧 admin** e ingresa
  el código de admin (`f1-2026` por defecto; cámbialo en `app/config.js`).
- Los códigos son un control de acceso **ligero** (apropiado para una liga de amigos), no
  seguridad bancaria: viven en `app/auth.js`. Si quieres puedes cambiarlos ahí.

## Horarios y cierre de inscripción

Los horarios oficiales 2026 están en `app/schedule.js` (en UTC; la app los muestra en CDMX).
El cierre de inscripción de cada carrera es el inicio de la **Clasificación** (o de la
**Clasificación Sprint** en fines de semana sprint: Inglaterra, Holanda y Singapur de aquí en
adelante). El administrador puede ajustar tiempos en `schedule.js` si la FIA mueve un horario.

## Cómo usarla

### Opción A — Probarla ya (modo local)
Abre `app/index.html` en el navegador (doble clic). Los datos se guardan en **ese**
navegador. Perfecto para ti solo o para probar.

### Opción B — Compartida online (recomendada: cada jugador entra sus picks)
Para que los 28 jugadores compartan los mismos datos hace falta un backend gratis (Supabase)
y subir la carpeta `app/` a la web (GitHub Pages). 10 minutos:

**1. Base de datos (Supabase, gratis)**
   1. Crea una cuenta en https://supabase.com y un proyecto nuevo.
   2. Abre **SQL Editor**, pega el contenido de `supabase/schema.sql` y dale **Run**.
   3. En **Project Settings → API** copia el **Project URL** y la **anon public key**.

**2. Conecta la app**
   Edita `app/config.js` y pega tus valores:
   ```js
   window.FF1_CONFIG = {
     SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGc...",
     ADMIN_PASSCODE: "elige-un-codigo",   // solo tú lo sabes
   };
   ```

**3. Publica (GitHub Pages, gratis)**
   1. Crea un repo en GitHub y sube **el contenido de la carpeta `app/`** (que `index.html`
      quede en la raíz del repo).
   2. En el repo: **Settings → Pages → Branch: main / root → Save**.
   3. Comparte el link `https://TU-USUARIO.github.io/TU-REPO/` en el chat.

   Cada quien entra, elige su nombre y captura sus pilotos. Tú entras como **admin**
   (botón 🔧 admin, arriba a la derecha) para capturar resultados y marcar pagos.

> Si dejas `config.js` vacío, la app sigue funcionando en modo local (un solo navegador).

---

## Flujo de cada carrera (para el organizador)

1. En **Resultados**, elige la carrera y ajusta *pilotos a elegir* (3/4). Si hace falta, edita el
   **cierre de inscripción** (campo fecha/hora en CDMX) o pulsa *Restaurar oficial*.
2. Los jugadores capturan sus pilotos en **Mi equipo** antes de la clasificación.
3. Tras la carrera, pulsa **⬇️ Cargar resultados oficiales**: trae posiciones, sprint y bonos de
   coequipero desde la F1 real (API Ergast/Jolpica) y calcula los puntos. Es **re-ejecutable** si la
   FIA modifica un resultado. El **Driver of the Day** (la API no lo da) y cualquier ajuste se ponen a
   mano en la tabla de captura.
4. **🔒 Cerrar carrera** → se congela la tabla y nadie puede cambiar picks.

> El cargador es un asistente: posiciones y puntos salen exactos; los bonos de coequipero son un
> cálculo automático que conviene revisar (casos como pilotos sustitutos o doble abandono).

---

## Estructura del proyecto

```
fantasy-f1/
├── app/                  ← esto es lo que se publica
│   ├── index.html
│   ├── styles.css
│   ├── app.js            ← lógica y vistas
│   ├── store.js          ← guardado (local o Supabase)
│   ├── config.js         ← tu configuración
│   └── data.js           ← historia 2026 importada del Excel (no editar a mano)
├── supabase/schema.sql   ← base de datos del modo compartido
├── data/                 ← JSON intermedios de la importación
└── README.md
```

Los totales de las 7 carreras ya jugadas fueron verificados uno a uno contra la pestaña
*Puntos* de tu Excel: coinciden exactamente.
