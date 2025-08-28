import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  // ✅ Authenticated & verified user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const designId = params.id

  // 1. Fetch the design to get the storage path
  const { data: design, error: fetchError } = await supabase
    .from('designs')
    .select('image_url')
    .eq('id', designId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !design) {
    return NextResponse.json({ error: 'Design not found' }, { status: 404 })
  }

  // Extract the file path from the public URL
  const path = design.image_url.split('/storage/v1/object/public/designs/')[1]

  // 2. Delete from storage
  const { error: storageError } = await supabase
    .storage
    .from('designs')
    .remove([path])

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 })
  }

  // 3. Delete from DB
  const { error: dbError } = await supabase
    .from('designs')
    .delete()
    .eq('id', designId)
    .eq('user_id', user.id)

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
