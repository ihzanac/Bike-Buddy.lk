type BookingReceiptApiPayload = {
  to: string
  shopName: string
  serviceName: string
  date: string
  time: string
  bikeNumber: string
  bikeType: string
  contactName: string
  phone: string
  totalLkr: number
  notes?: string
}

type BookingReceiptApiResponse = {
  ok?: boolean
  message?: string
}

const bookingReceiptApiPath =
  import.meta.env.VITE_BOOKING_RECEIPT_API_PATH ||
  (() => {
    const otpPath = import.meta.env.VITE_PASSWORD_OTP_API_PATH
    if (!otpPath) return '/api/customer-booking-receipt.php'
    try {
      return new URL('/api/customer-booking-receipt.php', otpPath).toString()
    } catch {
      return '/api/customer-booking-receipt.php'
    }
  })()

export async function sendBookingReceiptViaApi(payload: BookingReceiptApiPayload): Promise<void> {
  let res: Response
  try {
    res = await fetch(bookingReceiptApiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    throw new Error(msg || 'Could not reach booking email service.')
  }

  const raw = await res.text()
  let data: BookingReceiptApiResponse = {}
  try {
    data = raw ? (JSON.parse(raw) as BookingReceiptApiResponse) : {}
  } catch {
    throw new Error('Booking email service returned an invalid response.')
  }
  if (!res.ok || !data.ok) {
    throw new Error(data.message || `Booking email failed (${res.status}).`)
  }
}
