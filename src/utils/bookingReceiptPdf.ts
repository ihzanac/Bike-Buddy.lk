import { jsPDF } from 'jspdf'

export type BookingServiceLinePdf = {
  name: string
  priceLkr: number
  durationMinutes?: number
}

export type BookingReceiptPdfInput = {
  bookingId: string
  /** When the customer submitted the booking (ISO). */
  bookedAtIso: string
  shopName: string
  shopPhone?: string
  contactName: string
  bikeNumber: string
  bikeType: string
  bikeModel?: string
  phone: string
  email?: string
  serviceDate: string
  serviceTime: string
  servicesLine: string
  /** Per-service rows for the itemized table. */
  serviceLines: BookingServiceLinePdf[]
  totalLkr: number
  notes?: string
  locationLabel?: string
}

function formatLongDate(isoYmd: string): string {
  const [y, m, d] = isoYmd.split('-').map(Number)
  if (!y || !m || !d) return isoYmd
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return isoYmd
  return dt.toLocaleDateString('en-LK', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime12h(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return hhmm
  let h = Number(m[1])
  const min = m[2]
  const ap = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${min} ${ap}`
}

function money(n: number) {
  return `LKR ${n.toLocaleString()}`
}

/** Branded booking receipt with sections and itemized services (Helvetica, Sri Lanka–oriented copy). */
export function downloadBookingConfirmationPdf(data: BookingReceiptPdfInput) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 16
  const contentW = pageW - margin * 2
  let y = 0

  const bottomLimit = pageH - 18

  const newPageIf = (need: number) => {
    if (y + need > bottomLimit) {
      doc.setDrawColor(220, 220, 220)
      doc.setLineWidth(0.2)
      doc.line(margin, pageH - 10, pageW - margin, pageH - 10)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(120, 120, 120)
      doc.text('BikeBuddy.lk — Service booking receipt', margin, pageH - 6)
      doc.setTextColor(0, 0, 0)
      doc.addPage()
      y = margin
    }
  }

  const hr = () => {
    newPageIf(8)
    doc.setDrawColor(210, 220, 215)
    doc.setLineWidth(0.35)
    doc.line(margin, y, pageW - margin, y)
    y += 6
  }

  const sectionTitle = (label: string) => {
    newPageIf(12)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(4, 94, 70)
    doc.text(label.toUpperCase(), margin, y)
    doc.setTextColor(0, 0, 0)
    y += 5.5
  }

  const bodyLines = (text: string, size = 10) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(35, 35, 45)
    const lines = doc.splitTextToSize(text, contentW)
    const step = size * 0.44
    for (const ln of lines) {
      newPageIf(step + 1)
      doc.text(ln, margin, y)
      y += step
    }
    doc.setTextColor(0, 0, 0)
    y += 2
  }

  const bodyBold = (text: string, size = 10.5) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    const lines = doc.splitTextToSize(text, contentW)
    const step = size * 0.44
    for (const ln of lines) {
      newPageIf(step + 1)
      doc.text(ln, margin, y)
      y += step
    }
    doc.setTextColor(0, 0, 0)
    y += 1.5
  }

  // --- Header band ---
  const headerH = 34
  doc.setFillColor(5, 120, 85)
  doc.rect(0, 0, pageW, headerH, 'F')
  doc.setFillColor(16, 185, 129)
  doc.rect(0, headerH - 2, pageW, 2, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('BikeBuddy.lk', margin, 14)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Bike service booking — official receipt', margin, 22)
  doc.setFontSize(8.5)
  doc.setTextColor(220, 245, 235)
  doc.text('Batticaloa & Sri Lanka', pageW - margin, 14, { align: 'right' })
  doc.setTextColor(255, 255, 255)

  y = headerH + 10

  // Meta strip
  doc.setFillColor(236, 253, 245)
  doc.roundedRect(margin, y - 2, contentW, 16, 2, 2, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(6, 78, 59)
  doc.text('Booking reference', margin + 3, y + 4)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const refDisplay =
    data.bookingId.length > 28 ? `${data.bookingId.slice(0, 28)}…` : data.bookingId
  doc.text(refDisplay, margin + 3, y + 10)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Status', pageW - margin - 52, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Pending shop confirmation', pageW - margin - 3, y + 10, { align: 'right' })

  doc.setTextColor(0, 0, 0)
  y += 22

  const booked = new Date(data.bookedAtIso)
  const bookedStr = Number.isNaN(booked.getTime())
    ? data.bookedAtIso
    : booked.toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })
  bodyLines(`Submitted: ${bookedStr}`, 9)
  y -= 1
  hr()

  sectionTitle('Shop details')
  bodyBold(data.shopName, 11)
  if (data.locationLabel) bodyLines(data.locationLabel, 10)
  if (data.shopPhone) bodyLines(`Phone: ${data.shopPhone}`, 10)
  hr()

  sectionTitle('Your contact & bike')
  bodyLines(`Name: ${data.contactName}`, 10)
  bodyLines(`Phone: ${data.phone}`, 10)
  if (data.email) bodyLines(`Email: ${data.email}`, 10)
  bodyLines(`Bike number: ${data.bikeNumber}`, 10)
  bodyLines(`Type: ${data.bikeType}`, 10)
  if (data.bikeModel) bodyLines(`Model: ${data.bikeModel}`, 10)
  hr()

  sectionTitle('Appointment')
  bodyBold(formatLongDate(data.serviceDate), 11)
  bodyLines(`Time: ${formatTime12h(data.serviceTime)} (${data.serviceTime} 24h)`, 10)
  hr()

  sectionTitle('Selected services')
  if (!data.serviceLines.length) {
    bodyLines(data.servicesLine, 10)
  } else {
    newPageIf(28)
    const colName = margin + 2
    const colDur = pageW - margin - 58
    const colPrice = pageW - margin - 2

    doc.setFillColor(241, 245, 249)
    doc.roundedRect(margin, y - 1, contentW, 8, 1, 1, 'F')
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105)
    doc.text('SERVICE', colName, y + 4.5)
    doc.text('DURATION', colDur, y + 4.5)
    doc.text('PRICE', colPrice, y + 4.5, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    y += 11

    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.15)

    for (const row of data.serviceLines) {
      const nameLines = doc.splitTextToSize(row.name, colDur - colName - 14)
      const rowH = Math.max(7, nameLines.length * 4.2 + 3)
      newPageIf(rowH + 6)

      doc.line(margin, y - 1, pageW - margin, y - 1)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.text(nameLines, colName, y + 3.5)

      const dur =
        row.durationMinutes != null && row.durationMinutes > 0
          ? `~${row.durationMinutes} min`
          : '—'
      doc.setTextColor(100, 116, 139)
      doc.setFontSize(8.5)
      doc.text(dur, colDur, y + 3.5)
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.text(money(row.priceLkr), colPrice, y + 3.5, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      y += rowH
    }

    doc.setDrawColor(5, 120, 85)
    doc.setLineWidth(0.5)
    doc.line(margin, y + 1, pageW - margin, y + 1)
    y += 6

    newPageIf(12)
    doc.setFillColor(236, 253, 245)
    doc.roundedRect(margin, y - 1, contentW, 10, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(6, 78, 59)
    doc.text('Estimated total', margin + 3, y + 6.5)
    doc.text(money(data.totalLkr), colPrice, y + 6.5, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    y += 14
  }

  if (data.notes?.trim()) {
    hr()
    sectionTitle('Your notes')
    bodyLines(data.notes.trim(), 10)
  }

  y += 4
  hr()
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(71, 85, 105)
  const foot = doc.splitTextToSize(
    'This document is your copy of the request sent to the shop. The booking becomes confirmed only after the shop accepts it in their portal. Bring this receipt (printed or on your phone) if helpful.',
    contentW,
  )
  for (const ln of foot) {
    newPageIf(5)
    doc.text(ln, margin, y)
    y += 4.2
  }
  doc.setTextColor(0, 0, 0)

  const safeFile = data.bookingId.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40)
  doc.save(`BikeBuddy-booking-${safeFile}.pdf`)
}
