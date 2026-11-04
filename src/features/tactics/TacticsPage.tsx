import { useState } from 'react'
import { ArrowLeftRight, CircleDotDashed } from 'lucide-react'
import { useAuth } from '../../app/AuthProvider'
import { PageHeading } from '../../components/ui'
import { LineupEditor } from './lineups/LineupEditor'
import { PlayEditor } from './plays/PlayEditor'

type Tab = 'lineups' | 'plays'

export function TacticsPage() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('lineups')
  return <>
    <PageHeading
      eyebrow="TACTICA · CULLERA FC"
      title="La pizarra."
      description={profile?.role === 'coach' ? 'Diseña alineaciones y jugadas. El equipo las verá cuando las publiques.' : 'Alineaciones y movimientos preparados por el entrenador.'}
    />
    <div className="tactics-tabs" role="tablist" aria-label="Herramientas tácticas">
      <button type="button" role="tab" aria-selected={tab === 'lineups'} className={tab === 'lineups' ? 'active' : ''} onClick={() => setTab('lineups')}>
        <ArrowLeftRight size={16} /><span>Alineaciones</span>
      </button>
      <button type="button" role="tab" aria-selected={tab === 'plays'} className={tab === 'plays' ? 'active' : ''} onClick={() => setTab('plays')}>
        <CircleDotDashed size={16} /><span>Jugadas de pizarra</span>
      </button>
    </div>
    {tab === 'lineups' ? <LineupEditor /> : <PlayEditor />}
  </>
}
