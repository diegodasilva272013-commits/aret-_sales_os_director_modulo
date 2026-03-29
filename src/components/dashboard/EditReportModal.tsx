'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface EditReportModalProps {
  reporteId: string
  tipo: 'setter' | 'closer'
  onClose: () => void
  onSaved: () => void
}

const SETTER_FIELDS = [
  { key: 'leads_recibidos', label: 'Leads recibidos', type: 'number' },
  { key: 'intentos_contacto', label: 'Intentos de contacto', type: 'number' },
  { key: 'contactados', label: 'Contactados', type: 'number' },
  { key: 'citas_agendadas', label: 'Citas agendadas', type: 'number' },
  { key: 'citas_show', label: 'Citas show', type: 'number' },
  { key: 'citas_noshow', label: 'Citas no show', type: 'number' },
  { key: 'citas_reprogramadas', label: 'Citas reprogramadas', type: 'number' },
  { key: 'citas_calificadas', label: 'Citas calificadas', type: 'number' },
  { key: 'mensajes_enviados', label: 'Mensajes enviados', type: 'number' },
  { key: 'respuestas_obtenidas', label: 'Respuestas obtenidas', type: 'number' },
  { key: 'motivos_noshow', label: 'Motivos no show', type: 'text' },
  { key: 'comentario', label: 'Comentario', type: 'text' },
]

const CLOSER_FIELDS = [
  { key: 'citas_recibidas', label: 'Citas recibidas', type: 'number' },
  { key: 'citas_show', label: 'Citas show', type: 'number' },
  { key: 'citas_noshow', label: 'Citas no show', type: 'number' },
  { key: 'ventas_cerradas', label: 'Ventas cerradas', type: 'number' },
  { key: 'ventas_no_cerradas', label: 'Ventas no cerradas', type: 'number' },
  { key: 'monto_total_cerrado', label: 'Monto total cerrado', type: 'number' },
  { key: 'monto_cobrado', label: 'Monto cobrado', type: 'number' },
  { key: 'monto_pendiente', label: 'Monto pendiente', type: 'number' },
  { key: 'propuestas_enviadas', label: 'Propuestas enviadas', type: 'number' },
  { key: 'seguimientos_realizados', label: 'Seguimientos realizados', type: 'number' },
  { key: 'comentario', label: 'Comentario', type: 'text' },
]

export default function EditReportModal({ reporteId, tipo, onClose, onSaved }: EditReportModalProps) {
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [nombre, setNombre] = useState('')

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/reportes/${tipo}/${reporteId}`)
      const json = await res.json()
      if (json.report) {
        setReportData(json.report)
        const profiles = json.report.profiles as { nombre: string } | null
        setNombre(profiles?.nombre || 'N/A')
      } else {
        setError('No se pudo cargar el reporte')
      }
      setLoading(false)
    }
    load()
  }, [reporteId, tipo])

  async function handleSave() {
    if (!reportData) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch(`/api/reportes/${tipo}/${reporteId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(reportData),
    })

    if (!res.ok) {
      const j = await res.json()
      setError(j.error || 'Error al guardar')
      setSaving(false)
      return
    }

    setSuccess(true)
    setSaving(false)
    setTimeout(() => { onSaved(); onClose() }, 800)
  }

  function updateField(key: string, value: unknown) {
    setReportData(prev => prev ? { ...prev, [key]: value } : prev)
  }

  const fields = tipo === 'setter' ? SETTER_FIELDS : CLOSER_FIELDS

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg rounded-2xl border border-gray-800 shadow-2xl max-h-[85vh] flex flex-col" style={{ background: '#0D1117' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h3 className="text-lg font-bold text-white">Editar reporte</h3>
            <p className="text-sm text-gray-400">{nombre} — {tipo === 'setter' ? 'Setter' : 'Closer'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="text-indigo-400 animate-spin" />
            </div>
          )}

          {!loading && reportData && fields.map(f => (
            <div key={f.key}>
              <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
              {f.type === 'number' ? (
                <input
                  type="number"
                  value={reportData[f.key] as number ?? 0}
                  onChange={e => updateField(f.key, parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                />
              ) : (
                <textarea
                  value={(reportData[f.key] as string) ?? ''}
                  onChange={e => updateField(f.key, e.target.value)}
                  rows={2}
                  className="w-full bg-[#111827] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm resize-none"
                />
              )}
            </div>
          ))}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2">
              <p className="text-emerald-400 text-sm">Reporte actualizado correctamente</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors text-sm disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )
}
