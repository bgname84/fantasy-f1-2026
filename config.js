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
  ADMIN_PASSCODE: "f1-2026", // cámbialo: código para el organizador
};
