import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Expose SUPABASE_URL / SUPABASE_ANON_KEY (set in .env locally and in Vercel) to import.meta.env.
  // Only the anon key belongs here: it is public by design, and Row Level Security protects the data.
  envPrefix: ['VITE_', 'SUPABASE_'],
})
