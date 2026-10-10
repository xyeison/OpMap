import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// Cliente del NAVEGADOR con la anon key. Tras el endurecimiento de Supabase la anon key solo
// tiene SELECT en departments, municipalities, department_adjacency, hospitals y kams: no usar
// este cliente para escribir ni para leer otras tablas (hacerlo vía /api/* con service_role).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
