import { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react'
import { Icon } from './icons'

type ToastMsg = { msg: string; id?: string; err?: boolean }
const Ctx = createContext<(t: ToastMsg) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastHost({ children }: { children: ReactNode }) {
  const [t, setT] = useState<ToastMsg | null>(null)
  const [show, setShow] = useState(false)
  const timer = useRef<number>()
  const push = useCallback((n: ToastMsg) => {
    setT(n); setShow(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShow(false), 3000)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className={'toast' + (show ? ' show' : '') + (t?.err ? ' err' : '')}>
        <div className="tk"><Icon name={t?.err ? 'close' : 'check'} size={18} /></div>
        <div><b>{t?.msg}</b>{t?.id && <small>{t.id}</small>}</div>
      </div>
    </Ctx.Provider>
  )
}
