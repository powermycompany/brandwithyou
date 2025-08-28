import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Fetch design via token (anon allowed)
    const { data: design, error } = await supabase.rpc('get_design_by_share_token', {
      p_token: params.token,
    }).single()

    if (error || !design) {
      return new NextResponse('Not found or expired', { status: 404 })
    }

    // Build PDF (same “big image” layout you liked)
    const pdf = await PDFDocument.create()
    const page = pdf.addPage([595.28, 841.89])
    const { width, height } = page.getSize()
    const margin = 36
    const contentWidth = width - margin * 2
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

    page.drawText('Tech Pack (Shared)', {
      x: margin,
      y: height - margin - 12,
      size: 20,
      font: fontBold,
    })
    page.drawText(`Generated: ${new Date().toLocaleString()}`, {
      x: margin, y: height - margin - 35, size: 10, font, color: rgb(0.35,0.35,0.35),
    })

    let imageBottomY = height - margin - 60
    let blockBottomY = imageBottomY - 300

    try {
      const res = await fetch(design.image_url, { cache: 'no-store' })
      const arr = new Uint8Array(await res.arrayBuffer())
      const ct = res.headers.get('content-type') || ''

      const drawFullWidth = async (embed: any) => {
        const ratio = embed.width / embed.height
        const drawW = contentWidth
        const drawH = drawW / ratio
        page.drawImage(embed, { x: margin, y: imageBottomY - drawH, width: drawW, height: drawH })
        return imageBottomY - drawH - 16
      }

      if (ct.includes('png')) {
        const img = await pdf.embedPng(arr)
        blockBottomY = await drawFullWidth(img)
      } else if (ct.includes('jpeg') || ct.includes('jpg')) {
        const img = await pdf.embedJpg(arr)
        blockBottomY = await drawFullWidth(img)
      } else {
        page.drawText('Image (SVG/unsupported) — open URL:', {
          x: margin, y: imageBottomY - 14, size: 12, font: fontBold,
        })
        page.drawText(design.image_url, {
          x: margin, y: imageBottomY - 30, size: 10, font, color: rgb(0.1, 0.1, 0.8),
        })
        blockBottomY = imageBottomY - 50
      }
    } catch {
      page.drawText('Image could not be embedded.', {
        x: margin, y: imageBottomY - 14, size: 12, font: fontBold, color: rgb(0.8,0.1,0.1),
      })
      blockBottomY = imageBottomY - 30
    }

    const line = (label: string, value: string, y: number) => {
      page.drawText(`${label}:`, { x: margin, y, size: 12, font: fontBold })
      page.drawText(value, { x: margin + 90, y, size: 12, font })
    }

    line('Design ID', String(design.id), blockBottomY)
    line('Dimensions', `${design.width ?? '-'} × ${design.height ?? '-'} × ${design.depth ?? '-'} cm`, blockBottomY - 18)
    line('Material', design.material || '-', blockBottomY - 36)
    line('Color', design.color || '-', blockBottomY - 54)
    line('Created', new Date(design.created_at).toLocaleString(), blockBottomY - 72)

    const bytes = await pdf.save()
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="tech-pack-shared.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error(e)
    return new NextResponse('Server error', { status: 500 })
  }
}
