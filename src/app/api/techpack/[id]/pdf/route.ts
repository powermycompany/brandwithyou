import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const dynamic = 'force-dynamic' // run fresh per request

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  // 1) Verified identity (owner check relies on this)
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // 2) Fetch design & enforce owner-only access
  const { data: design, error: designErr } = await supabase
    .from('designs')
    .select('*')
    .eq('id', params.id)
    .single()

  if (designErr || !design) {
    return new NextResponse('Not found', { status: 404 })
  }
  if (design.user_id !== user.id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // 3) Build PDF (keeps your larger image layout)
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89]) // A4 @ 72dpi
  const { width, height } = page.getSize()

  const margin = 36
  const contentWidth = width - margin * 2

  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Header
  page.drawText('Tech Pack', {
    x: margin,
    y: height - margin - 12,
    size: 20,
    font: fontBold,
  })
  page.drawText(`Generated: ${new Date().toLocaleString()}`, {
    x: margin,
    y: height - margin - 35,
    size: 10,
    font,
    color: rgb(0.35, 0.35, 0.35),
  })

  // 4) Try to embed image full width (PNG/JPG); fall back for SVG/unknown
  let imageBottomY = height - margin - 60
  let blockBottomY = imageBottomY - 300 // reserved space if embed fails

  try {
    const res = await fetch(design.image_url, { cache: 'no-store' })
    const arr = new Uint8Array(await res.arrayBuffer())
    const ct = res.headers.get('content-type') || ''

    const drawFullWidth = async (embed: any) => {
      const ratio = embed.width / embed.height
      const drawW = contentWidth
      const drawH = drawW / ratio
      page.drawImage(embed, {
        x: margin,
        y: imageBottomY - drawH,
        width: drawW,
        height: drawH,
      })
      return imageBottomY - drawH - 16
    }

    if (ct.includes('png')) {
      const img = await pdf.embedPng(arr)
      blockBottomY = await drawFullWidth(img)
    } else if (ct.includes('jpeg') || ct.includes('jpg')) {
      const img = await pdf.embedJpg(arr)
      blockBottomY = await drawFullWidth(img)
    } else {
      // Fallback (e.g., SVG or unknown): show link instead
      page.drawText('Image (SVG/unsupported) — open URL:', {
        x: margin,
        y: imageBottomY - 14,
        size: 12,
        font: fontBold,
      })
      page.drawText(design.image_url, {
        x: margin,
        y: imageBottomY - 30,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.8),
      })
      blockBottomY = imageBottomY - 50
    }
  } catch {
    page.drawText('Image could not be embedded.', {
      x: margin,
      y: imageBottomY - 14,
      size: 12,
      font: fontBold,
      color: rgb(0.8, 0.1, 0.1),
    })
    blockBottomY = imageBottomY - 30
  }

  // 5) Specs block
  const specTop = blockBottomY
  const line = (label: string, value: string, y: number) => {
    page.drawText(`${label}:`, { x: margin, y, size: 12, font: fontBold })
    page.drawText(value, { x: margin + 90, y, size: 12, font })
  }

  line('Design ID', design.id, specTop)
  line('Dimensions', `${design.width ?? '-'} × ${design.height ?? '-'} × ${design.depth ?? '-'} cm`, specTop - 18)
  line('Material', design.material || '-', specTop - 36)
  line('Color', design.color || '-', specTop - 54)
  line('Created', new Date(design.created_at).toLocaleString(), specTop - 72)

  // 6) Return as a downloadable PDF
  const pdfBytes = await pdf.save()
  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tech-pack-${params.id}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
