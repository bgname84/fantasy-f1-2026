// ============================================================
//  CONFIGURACIÓN
// ------------------------------------------------------------
//  MODO LOCAL (por defecto): deja SUPABASE_URL vacío. Los datos
//  se guardan en este navegador (localStorage). Perfecto para
//  probar la app o usarla tú solo.
//
//  MODO COMPARTIDO (online, cada jugador entra sus picks):
//  1. Crea un proyecto gratis en https://supabase.com
//  2. En SQL Editor pega y corre  supabase/schema.sql
//  3. Copia tu Project URL y la "anon public" key aquí abajo.
//  Listo: todos los que abran el link comparten los mismos datos.
// ============================================================
window.FF1_CONFIG = {
  SUPABASE_URL: "https://uknphyocdhieuchefdro.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrbnBoeW9jZGhpZXVjaGVmZHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTExMTUsImV4cCI6MjA5ODIyNzExNX0.z2aikNZ_6LYhNR2BO99KvnvZipWmEcBXbODaYlV05Oo",
  // Administradores: códigos de jugador que entran como ADMIN automáticamente
  // (con su propio código de acceso). BG = Beli Garcia, FV = Federico Valverde.
  ADMINS: ["BG", "FV"],
  // ------------------------------------------------------------
  //  BETA: ESCRITURA ACTIVADA (misma base que la app estable).
  //  Las dos versiones apuntan al MISMO proyecto de Supabase, así que
  //  hay una sola base de datos: lo que guardes en la beta aparece al
  //  instante en la estable y al revés (store.js se suscribe a los
  //  cambios en vivo de picks/results/race_meta/payments).
  //  Si alguna vez quieres congelar la beta para que no escriba,
  //  cambia esto a true y toda escritura queda bloqueada.
  // ------------------------------------------------------------
  READ_ONLY: false,
};
