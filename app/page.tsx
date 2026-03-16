import { supabase } from './lib/supabase'

export default async function Home() {
  const { data, error } = await supabase.from('tripu_customer').select('*').limit(5)
  
  return (
    <main>
      <h1>Test Supabase</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
      {error && <p>Error: {error.message}</p>}
    </main>
  )
}