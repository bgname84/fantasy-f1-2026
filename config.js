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
  SUPABASE_URL: "",          // ej: "https://abcd1234.supabase.co"
  SUPABASE_ANON_KEY: "",     // ej: "eyJhbGc..."
  ADMIN_PASSCODE: "f1-2026", // cámbialo: código para el organizador
};
