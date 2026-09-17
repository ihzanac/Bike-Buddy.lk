import { useEffect, useState } from 'react'

/** Fixed top bar showing page scroll % — matches customer home design */
export function CustomerScrollProgress() {
  const [w, setW] = useState(0)
  useEffect(() => {
    const on = () => {
      const st = document.documentElement.scrollTop || document.body.scrollTop
      const sh = document.documentElement.scrollHeight - document.documentElement.clientHeight
      setW(sh > 0 ? (st / sh) * 100 : 0)
    }
    window.addEventListener('scroll', on, { passive: true })
    on()
    return () => window.removeEventListener('scroll', on)
  }, [])
  return <div className="bbl-cust-scroll" style={{ width: `${w}%` }} aria-hidden />
}
