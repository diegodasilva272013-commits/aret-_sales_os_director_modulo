import BriefClient from '@/app/dashboard/proyectos/[id]/brief/BriefClient'

export default function PublicBriefPage({ params }: { params: { id: string } }) {
  return <BriefClient proyectoId={params.id} readOnly />
}
