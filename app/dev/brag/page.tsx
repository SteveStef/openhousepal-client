'use client'

// Dev proof: the Brag Sheet PDF rendered from sample data (window.__pdf = base64 when ready).
import { useEffect, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { AgentBragSheetDocument } from '@/lib/pdfs'

export default function BragProof() {
  const [state, setState] = useState('rendering')
  useEffect(() => {
    const agent = { name: 'Peter Stefanatos', title: 'Realtor', brokerage: 'Compass', bio: 'Helping buyers and sellers across the Main Line.', hubUrl: 'https://openhousepal.com/peterstefanatos', phone: '(610) 555-0100', email: 'peter@example.com' }
    const sales = [1, 2, 3].map(i => ({ id: String(i), address: `${100 + i} Oak St`, city: 'Wayne', state: 'PA', price: 800000 + i * 50000, beds: 4, baths: 3, sqft: 2800 }))
    pdf(<AgentBragSheetDocument agent={agent} recentSales={sales} />).toBlob().then(async b => {
      const buf = new Uint8Array(await b.arrayBuffer())
      let s = ''
      for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i])
      ;(window as any).__pdf = btoa(s)
      setState('ready')
    }).catch(e => setState('error ' + e))
  }, [])
  return <div data-state={state}>{state}</div>
}
