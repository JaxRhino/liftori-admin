import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qlerfkdyslndjbaltkwo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZXJma2R5c2xuZGpiYWx0a3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTc0MTAsImV4cCI6MjA4ODczMzQxMH0.NM-bFnfWqrnelLnpYO8NNMVpwkoq4LSfCIVq6gs23qk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
