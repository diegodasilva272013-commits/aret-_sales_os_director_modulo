'use client'

import { useParams } from 'next/navigation'
import BriefClient from './BriefClient'

export default function BriefPage() {
  const params = useParams()
  const id = params.id as string
  return <BriefClient proyectoId={id} />
}
