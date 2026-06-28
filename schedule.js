// ============================================================
//  HORARIOS OFICIALES F1 2026 (en UTC)
//  deadline = cierre de inscripción de pilotos:
//    - fin de semana NORMAL  -> inicio de la Clasificación
//    - fin de semana SPRINT  -> inicio de la Clasificación Sprint
//  Las horas se muestran en la app en hora de Ciudad de México.
//  El admin puede ajustar el cierre en la pestaña Resultados.
// ============================================================
window.FF1_SCHEDULE = {
  "AUSTRALIA":  { sprint:false, race:"2026-03-08T04:00:00Z" },
  "CHINA":      { sprint:true,  race:"2026-03-22T07:00:00Z" },
  "JAPON":      { sprint:false, race:"2026-04-12T05:00:00Z" },
  "MIAMI":      { sprint:true,  race:"2026-05-03T19:30:00Z" },
  "CANADA":     { sprint:true,  race:"2026-05-24T18:00:00Z" },
  "MONACO":     { sprint:false, race:"2026-06-07T13:00:00Z" },
  "BARCELONA":  { sprint:false, race:"2026-06-14T13:00:00Z" },

  "AUSTRIA":    { sprint:false, quali:"2026-06-27T13:00:00Z", race:"2026-06-28T12:00:00Z" },
  "INGLATERRA": { sprint:true,  sprintQuali:"2026-07-03T15:30:00Z", quali:"2026-07-04T15:00:00Z", sprintRace:"2026-07-04T11:00:00Z", race:"2026-07-05T14:00:00Z" },
  "BELGICA":    { sprint:false, quali:"2026-07-18T14:00:00Z", race:"2026-07-19T13:00:00Z" },
  "HUNGRIA":    { sprint:false, quali:"2026-07-25T14:00:00Z", race:"2026-07-26T13:00:00Z" },
  "HOLANDA":    { sprint:true,  sprintQuali:"2026-08-21T14:30:00Z", quali:"2026-08-22T14:00:00Z", sprintRace:"2026-08-22T10:00:00Z", race:"2026-08-23T13:00:00Z" },
  "ITALIA":     { sprint:false, quali:"2026-09-05T14:00:00Z", race:"2026-09-06T13:00:00Z" },
  "ESPAÑA":     { sprint:false, quali:"2026-09-12T14:00:00Z", race:"2026-09-13T13:00:00Z" },
  "BAKU":       { sprint:false, quali:"2026-09-25T12:00:00Z", race:"2026-09-26T11:00:00Z" },
  "SINGAPORE":  { sprint:true,  sprintQuali:"2026-10-09T12:30:00Z", quali:"2026-10-10T13:00:00Z", sprintRace:"2026-10-10T09:00:00Z", race:"2026-10-11T12:00:00Z" },
  "USA":        { sprint:false, quali:"2026-10-24T21:00:00Z", race:"2026-10-25T19:00:00Z" },
  "MEXICO":     { sprint:false, quali:"2026-10-31T20:00:00Z", race:"2026-11-01T19:00:00Z" },
  "BRAZIL":     { sprint:false, quali:"2026-11-07T17:00:00Z", race:"2026-11-08T16:00:00Z" },
  "LAS VEGAS":  { sprint:false, quali:"2026-11-21T03:00:00Z", race:"2026-11-22T03:00:00Z" },
  "QATAR":      { sprint:false, quali:"2026-11-28T17:00:00Z", race:"2026-11-29T15:00:00Z" },
  "ABU DHABI":  { sprint:false, quali:"2026-12-05T13:00:00Z", race:"2026-12-06T12:00:00Z" },
};
// deadline efectivo = clasificación sprint (si hay) o clasificación normal
window.FF1_DEADLINE = function (name) {
  const s = window.FF1_SCHEDULE[name]; if (!s) return null;
  return s.sprintQuali || s.quali || null;
};
