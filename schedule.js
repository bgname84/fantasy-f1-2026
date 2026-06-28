// ============================================================
//  HORARIOS OFICIALES F1 2026 (en UTC) — fuente: API Ergast/Jolpica
//  deadline = cierre de inscripción de pilotos:
//    - fin de semana NORMAL  -> inicio de la Clasificación
//    - fin de semana SPRINT  -> inicio de la Clasificación Sprint
//  apiRound = número de ronda en la API (sin las carreras canceladas),
//  se usa para cargar resultados oficiales.
//  Las horas se MUESTRAN en la app en hora de Ciudad de México.
//  El admin puede ajustar el cierre de cada carrera desde Resultados.
// ============================================================
window.FF1_SCHEDULE = {
  "AUSTRALIA":  { sprint:false, apiRound:1,  quali:"2026-03-07T05:00:00Z", race:"2026-03-08T04:00:00Z" },
  "CHINA":      { sprint:true,  apiRound:2,  sprintQuali:"2026-03-13T07:30:00Z", quali:"2026-03-14T07:00:00Z", race:"2026-03-15T07:00:00Z" },
  "JAPON":      { sprint:false, apiRound:3,  quali:"2026-03-28T06:00:00Z", race:"2026-03-29T05:00:00Z" },
  "MIAMI":      { sprint:true,  apiRound:4,  sprintQuali:"2026-05-01T20:30:00Z", quali:"2026-05-02T20:00:00Z", race:"2026-05-03T20:00:00Z" },
  "CANADA":     { sprint:true,  apiRound:5,  sprintQuali:"2026-05-22T20:30:00Z", quali:"2026-05-23T20:00:00Z", race:"2026-05-24T20:00:00Z" },
  "MONACO":     { sprint:false, apiRound:6,  quali:"2026-06-06T14:00:00Z", race:"2026-06-07T13:00:00Z" },
  "BARCELONA":  { sprint:false, apiRound:7,  quali:"2026-06-13T14:00:00Z", race:"2026-06-14T13:00:00Z" },
  "AUSTRIA":    { sprint:false, apiRound:8,  quali:"2026-06-27T14:00:00Z", race:"2026-06-28T13:00:00Z" },
  "INGLATERRA": { sprint:true,  apiRound:9,  sprintQuali:"2026-07-03T15:30:00Z", quali:"2026-07-04T15:00:00Z", race:"2026-07-05T14:00:00Z" },
  "BELGICA":    { sprint:false, apiRound:10, quali:"2026-07-18T14:00:00Z", race:"2026-07-19T13:00:00Z" },
  "HUNGRIA":    { sprint:false, apiRound:11, quali:"2026-07-25T14:00:00Z", race:"2026-07-26T13:00:00Z" },
  "HOLANDA":    { sprint:true,  apiRound:12, sprintQuali:"2026-08-21T14:30:00Z", quali:"2026-08-22T14:00:00Z", race:"2026-08-23T13:00:00Z" },
  "ITALIA":     { sprint:false, apiRound:13, quali:"2026-09-05T14:00:00Z", race:"2026-09-06T13:00:00Z" },
  "ESPAÑA":     { sprint:false, apiRound:14, quali:"2026-09-12T14:00:00Z", race:"2026-09-13T13:00:00Z" },
  "BAKU":       { sprint:false, apiRound:15, quali:"2026-09-25T12:00:00Z", race:"2026-09-26T11:00:00Z" },
  "SINGAPORE":  { sprint:true,  apiRound:16, sprintQuali:"2026-10-09T12:30:00Z", quali:"2026-10-10T13:00:00Z", race:"2026-10-11T12:00:00Z" },
  "USA":        { sprint:false, apiRound:17, quali:"2026-10-24T21:00:00Z", race:"2026-10-25T20:00:00Z" },
  "MEXICO":     { sprint:false, apiRound:18, quali:"2026-10-31T21:00:00Z", race:"2026-11-01T20:00:00Z" },
  "BRAZIL":     { sprint:false, apiRound:19, quali:"2026-11-07T18:00:00Z", race:"2026-11-08T17:00:00Z" },
  "LAS VEGAS":  { sprint:false, apiRound:20, quali:"2026-11-21T04:00:00Z", race:"2026-11-22T04:00:00Z" },
  "QATAR":      { sprint:false, apiRound:21, quali:"2026-11-28T18:00:00Z", race:"2026-11-29T16:00:00Z" },
  "ABU DHABI":  { sprint:false, apiRound:22, quali:"2026-12-05T14:00:00Z", race:"2026-12-06T13:00:00Z" },
};
// deadline efectivo = clasificación sprint (si hay) o clasificación normal
window.FF1_DEADLINE = function (name) {
  const s = window.FF1_SCHEDULE[name]; if (!s) return null;
  return s.sprintQuali || s.quali || null;
};
