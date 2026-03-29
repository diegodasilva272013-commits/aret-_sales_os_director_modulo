'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit2, Save, X, Globe, Share2, Download } from 'lucide-react'
import { generateBriefPDF } from '@/lib/generateBriefPDF'
import AudioRecorder from '@/components/AudioRecorder'

interface Brief {
  id?: string
  proyecto_id?: string
  nombre_producto?: string
  descripcion_producto?: string
  precio_desde?: number | null
  precio_hasta?: number | null
  pagina_web?: string
  instagram?: string
  facebook?: string
  youtube?: string
  linkedin?: string
  tiktok?: string
  avatar_nombre?: string
  avatar_edad_rango?: string
  avatar_ocupacion?: string
  avatar_dolores?: string
  avatar_deseos?: string
  avatar_objeciones?: string
  experto_nombre?: string
  experto_bio?: string
  experto_logros?: string
  experto_foto_url?: string
  mensajes_apertura?: string
  preguntas_frecuentes?: string
  argumentos_cierre?: string
  manejo_objeciones?: string
  proceso_setter?: string
  proceso_closer?: string
  notas_adicionales?: string
  // New fields
  diferenciadores?: string
  motivos_compra?: string
  oferta?: string
  observaciones_estrategicas?: string
  videos?: string
  links_importantes?: string
  publico_objetivo?: string
}

interface Proyecto {
  id: string
  nombre: string
  tipo?: string
  empresa?: string
}

interface Comisiones {
  porcentaje_setter?: number
  porcentaje_closer?: number
  monto_minimo?: number
  notas?: string
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: '#080B14',
  border: '1px solid #1a2234',
  borderRadius: 8,
  padding: '8px 12px',
  color: '#F1F5F9',
  fontSize: 13,
  outline: 'none',
  resize: 'vertical' as const,
}

function Section({ title, gradient, children }: { title: string; gradient: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#0D1117', border: '1px solid #1a2234', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '12px 20px', background: gradient, borderBottom: '1px solid #1a2234' }}>
        <h3 style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 700, margin: 0 }}>{title}</h3>
      </div>
      <div style={{ padding: '1.25rem' }}>{children}</div>
    </div>
  )
}

function TextField({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <p style={{ color: '#64748B', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</p>}
      <div style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  )
}

function BulletList({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  const items = value.split('\n').filter(Boolean)
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ color: '#64748B', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</p>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {items.map((item, i) => (
          <li key={i} style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.8 }}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function StepList({ value }: { value?: string }) {
  if (!value) return null
  const steps = value.split('\n').filter(Boolean)
  return (
    <div>
      {steps.map((step, i) => (
        <div key={i} className="flex gap-3" style={{ marginBottom: 8 }}>
          <div style={{
            minWidth: 22, height: 22, borderRadius: '50%', background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#818CF8', fontSize: 11, fontWeight: 700, flexShrink: 0
          }}>
            {i + 1}
          </div>
          <p style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{step}</p>
        </div>
      ))}
    </div>
  )
}

function EditField({ label, value, onChange, rows = 1 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ color: '#64748B', fontSize: 11, display: 'block', marginBottom: 4 }}>{label}</label>
      {rows > 1 ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} style={fieldStyle} />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} style={fieldStyle} />
      )}
    </div>
  )
}

export default function BriefClient({ proyectoId, readOnly = false }: { proyectoId: string; readOnly?: boolean }) {
  const [brief, setBrief] = useState<Brief>({})
  const [proyecto, setProyecto] = useState<Proyecto | null>(null)
  const [comisiones, setComisiones] = useState<Comisiones | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editBrief, setEditBrief] = useState<Brief>({})
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/proyectos/${proyectoId}/brief`)
      .then(r => {
        if (r.status === 403) { setAccessDenied(true); setLoading(false); return null }
        if (r.status === 401) { window.location.href = '/login'; return null }
        return r.ok ? r.json() : {}
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((d: any) => {
        if (!d) return
        setBrief(d.brief || {})
        setEditBrief(d.brief || {})
        setProyecto(d.proyecto || null)
        setComisiones(d.comisiones || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [proyectoId])

  function setField(key: keyof Brief, value: string) {
    setEditBrief(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/proyectos/${proyectoId}/brief`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editBrief),
    })
    if (res.ok) {
      const saved = await res.json()
      setBrief(saved)
      setEditBrief(saved)
      setEditing(false)
    }
    setSaving(false)
  }

  function handleShare() {
    const url = `${window.location.origin}/brief/${proyectoId}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080B14' }}>
      <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
    </div>
  )

  if (accessDenied) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080B14' }}>
      <div className="text-center" style={{ maxWidth: 400 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#F87171', fontSize: 24
        }}>🔒</div>
        <h2 style={{ color: '#F1F5F9', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Acceso restringido</h2>
        <p style={{ color: '#64748B', fontSize: 13, marginBottom: 20 }}>
          No tenés acceso a este brief. Solo los miembros asignados al proyecto pueden verlo.
        </p>
        <Link href="/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
          color: '#818CF8', textDecoration: 'none',
        }}>
          <ArrowLeft size={13} />
          Volver al dashboard
        </Link>
      </div>
    </div>
  )

  const b = editing ? editBrief : brief

  return (
    <div className="min-h-screen" style={{ background: '#080B14' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Top bar */}
        {!readOnly && (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link href={`/dashboard/proyectos`} style={{ color: '#475569' }}>
                <ArrowLeft size={18} />
              </Link>
              <span style={{ color: '#64748B', fontSize: 13 }}>Brief del Proyecto</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                style={{
                  background: 'transparent', border: '1px solid #1a2234', borderRadius: 8,
                  padding: '6px 14px', color: '#64748B', fontSize: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <Share2 size={13} />
                {copied ? 'Copiado!' : 'Compartir'}
              </button>
              <button
                onClick={() => brief && proyecto && generateBriefPDF(brief, proyecto, comisiones)}
                style={{
                  background: 'transparent', border: '1px solid #1a2234', borderRadius: 8,
                  padding: '6px 14px', color: '#64748B', fontSize: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <Download size={13} />
                PDF
              </button>
              {editing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                      border: 'none', borderRadius: 8, padding: '6px 16px',
                      color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <Save size={13} />
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setEditBrief(brief) }}
                    style={{ background: 'transparent', border: '1px solid #1a2234', borderRadius: 8, padding: '6px 12px', color: '#64748B', fontSize: 12, cursor: 'pointer' }}
                  >
                    <X size={13} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  style={{
                    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: 8, padding: '6px 14px', color: '#818CF8', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <Edit2 size={13} />
                  Editar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Header section */}
        <div style={{
          background: 'linear-gradient(135deg, #0D1117 0%, #0a0f1a 100%)',
          border: '1px solid #1a2234', borderRadius: 16, padding: '2rem', marginBottom: 16
        }}>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EditField label="Nombre del producto" value={editBrief.nombre_producto || ''} onChange={v => setField('nombre_producto', v)} />
              <EditField label="Precio desde" value={String(editBrief.precio_desde || '')} onChange={v => setField('precio_desde', v)} />
              <EditField label="Precio hasta" value={String(editBrief.precio_hasta || '')} onChange={v => setField('precio_hasta', v)} />
              <EditField label="Página web" value={editBrief.pagina_web || ''} onChange={v => setField('pagina_web', v)} />
              <EditField label="Instagram" value={editBrief.instagram || ''} onChange={v => setField('instagram', v)} />
              <EditField label="Facebook" value={editBrief.facebook || ''} onChange={v => setField('facebook', v)} />
              <EditField label="YouTube" value={editBrief.youtube || ''} onChange={v => setField('youtube', v)} />
              <EditField label="LinkedIn" value={editBrief.linkedin || ''} onChange={v => setField('linkedin', v)} />
              <EditField label="TikTok" value={editBrief.tiktok || ''} onChange={v => setField('tiktok', v)} />
              <div className="sm:col-span-2">
                <EditField label="Videos (URLs, uno por línea)" value={editBrief.videos || ''} onChange={v => setField('videos', v)} rows={2} />
              </div>
              <div className="sm:col-span-2">
                <EditField label="Links importantes (uno por línea)" value={editBrief.links_importantes || ''} onChange={v => setField('links_importantes', v)} rows={2} />
              </div>
              <div className="sm:col-span-2">
                <EditField label="Descripción del producto" value={editBrief.descripcion_producto || ''} onChange={v => setField('descripcion_producto', v)} rows={3} />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-4 mb-4">
                <div>
                  <h1 style={{ color: '#F1F5F9', fontWeight: 800, fontSize: 26, marginBottom: 4 }}>
                    {proyecto?.nombre || 'Sin nombre'}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2">
                    {proyecto?.tipo && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                        borderRadius: 6, padding: '2px 8px', color: '#818CF8'
                      }}>
                        {proyecto.tipo}
                      </span>
                    )}
                    {b.nombre_producto && (
                      <span style={{ color: '#64748B', fontSize: 13 }}>{b.nombre_producto}</span>
                    )}
                    {(b.precio_desde || b.precio_hasta) && (
                      <span style={{ color: '#34D399', fontSize: 13, fontWeight: 600 }}>
                        ${b.precio_desde?.toLocaleString()} – ${b.precio_hasta?.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {b.descripcion_producto && (
                <p style={{ color: '#94A3B8', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>{b.descripcion_producto}</p>
              )}
              <div className="flex flex-wrap gap-3">
                {b.pagina_web && (
                  <a href={b.pagina_web} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6366F1' }}>
                    <Globe size={13} /> Web
                  </a>
                )}
                {b.instagram && <a href={`https://instagram.com/${b.instagram}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#818CF8' }}>@{b.instagram}</a>}
                {b.linkedin && <a href={b.linkedin} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#818CF8' }}>LinkedIn</a>}
                {b.youtube && <a href={b.youtube} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#818CF8' }}>YouTube</a>}
                {b.tiktok && <a href={`https://tiktok.com/@${b.tiktok}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#818CF8' }}>TikTok</a>}
              </div>
              {b.videos && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ color: '#64748B', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Videos</p>
                  <div className="flex flex-wrap gap-2">
                    {b.videos.split('\n').filter(Boolean).map((v, i) => (
                      <a key={i} href={v.trim()} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#818CF8', background: 'rgba(99,102,241,0.06)', padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.15)' }}>
                        🎬 Video {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {b.links_importantes && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ color: '#64748B', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Links Importantes</p>
                  <div className="flex flex-wrap gap-2">
                    {b.links_importantes.split('\n').filter(Boolean).map((l, i) => (
                      <a key={i} href={l.trim()} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#6366F1', background: 'rgba(99,102,241,0.06)', padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.15)' }}>
                        🔗 {l.trim().replace(/^https?:\/\//, '').split('/')[0]}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* La Oferta */}
        {(editing || b.oferta) && (
          <Section title="La Oferta" gradient="linear-gradient(135deg, rgba(52,211,153,0.1) 0%, rgba(251,191,36,0.06) 100%)">
            {editing ? (
              <EditField label="Describe la oferta del experto en detalle" value={editBrief.oferta || ''} onChange={v => setField('oferta', v)} rows={5} />
            ) : (
              <TextField label="" value={b.oferta} />
            )}
          </Section>
        )}

        {/* Público Objetivo */}
        {(editing || b.publico_objetivo) && (
          <Section title="Público Objetivo" gradient="linear-gradient(135deg, rgba(167,139,250,0.1) 0%, rgba(139,92,246,0.06) 100%)">
            {editing ? (
              <EditField label="¿A quién va dirigido?" value={editBrief.publico_objetivo || ''} onChange={v => setField('publico_objetivo', v)} rows={3} />
            ) : (
              <TextField label="" value={b.publico_objetivo} />
            )}
          </Section>
        )}

        {/* El Experto */}
        <Section title="El Experto" gradient="linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)">
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EditField label="Nombre" value={editBrief.experto_nombre || ''} onChange={v => setField('experto_nombre', v)} />
              <EditField label="Foto URL" value={editBrief.experto_foto_url || ''} onChange={v => setField('experto_foto_url', v)} />
              <div className="sm:col-span-2"><EditField label="Bio" value={editBrief.experto_bio || ''} onChange={v => setField('experto_bio', v)} rows={3} /></div>
              <div className="sm:col-span-2"><EditField label="Logros (uno por línea)" value={editBrief.experto_logros || ''} onChange={v => setField('experto_logros', v)} rows={3} /></div>
            </div>
          ) : (
            <div className="flex gap-4">
              {b.experto_foto_url && (
                <img src={b.experto_foto_url} alt="" style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div>
                {b.experto_nombre && <h4 style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{b.experto_nombre}</h4>}
                <TextField label="" value={b.experto_bio} />
                <BulletList label="Logros" value={b.experto_logros} />
              </div>
            </div>
          )}
        </Section>

        {/* Avatar del Cliente */}
        <Section title="Avatar del Cliente Ideal" gradient="linear-gradient(135deg, rgba(52,211,153,0.08) 0%, rgba(16,185,129,0.05) 100%)">
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EditField label="Nombre del avatar" value={editBrief.avatar_nombre || ''} onChange={v => setField('avatar_nombre', v)} />
              <EditField label="Rango de edad" value={editBrief.avatar_edad_rango || ''} onChange={v => setField('avatar_edad_rango', v)} />
              <EditField label="Ocupación" value={editBrief.avatar_ocupacion || ''} onChange={v => setField('avatar_ocupacion', v)} />
              <div className="sm:col-span-2"><EditField label="Dolores (uno por línea)" value={editBrief.avatar_dolores || ''} onChange={v => setField('avatar_dolores', v)} rows={3} /></div>
              <div className="sm:col-span-2"><EditField label="Deseos (uno por línea)" value={editBrief.avatar_deseos || ''} onChange={v => setField('avatar_deseos', v)} rows={3} /></div>
              <div className="sm:col-span-2"><EditField label="Objeciones comunes (una por línea)" value={editBrief.avatar_objeciones || ''} onChange={v => setField('avatar_objeciones', v)} rows={3} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                {b.avatar_nombre && <p style={{ color: '#F1F5F9', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{b.avatar_nombre}</p>}
                {b.avatar_edad_rango && <p style={{ color: '#64748B', fontSize: 12, marginBottom: 8 }}>{b.avatar_edad_rango} · {b.avatar_ocupacion}</p>}
                <BulletList label="Dolores" value={b.avatar_dolores} />
              </div>
              <div>
                <BulletList label="Deseos" value={b.avatar_deseos} />
                <BulletList label="Objeciones comunes" value={b.avatar_objeciones} />
              </div>
            </div>
          )}
        </Section>

        {/* Motivos de Compra */}
        {(editing || b.motivos_compra) && (
          <Section title="¿Por qué comprarían?" gradient="linear-gradient(135deg, rgba(52,211,153,0.1) 0%, rgba(52,211,153,0.05) 100%)">
            {editing ? (
              <EditField label="Razones de compra (una por línea)" value={editBrief.motivos_compra || ''} onChange={v => setField('motivos_compra', v)} rows={4} />
            ) : (
              <BulletList label="" value={b.motivos_compra} />
            )}
          </Section>
        )}

        {/* Diferenciadores */}
        {(editing || b.diferenciadores) && (
          <Section title="Diferenciadores" gradient="linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(245,158,11,0.05) 100%)">
            {editing ? (
              <EditField label="¿Qué lo diferencia de la competencia? (uno por línea)" value={editBrief.diferenciadores || ''} onChange={v => setField('diferenciadores', v)} rows={4} />
            ) : (
              <BulletList label="" value={b.diferenciadores} />
            )}
          </Section>
        )}

        {/* Mensajes de Apertura */}
        <Section title="Mensajes de Apertura" gradient="linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(245,158,11,0.05) 100%)">
          {editing ? (
            <EditField label="" value={editBrief.mensajes_apertura || ''} onChange={v => setField('mensajes_apertura', v)} rows={5} />
          ) : (
            <div style={{ background: '#080B14', borderRadius: 8, padding: '1rem', border: '1px solid #1a2234' }}>
              <p style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>{b.mensajes_apertura || 'Sin contenido'}</p>
            </div>
          )}
        </Section>

        {/* Proceso Setter */}
        <Section title="Proceso Setter" gradient="linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(99,102,241,0.04) 100%)">
          {editing ? (
            <EditField label="Un paso por línea" value={editBrief.proceso_setter || ''} onChange={v => setField('proceso_setter', v)} rows={5} />
          ) : (
            <StepList value={b.proceso_setter} />
          )}
        </Section>

        {/* Proceso Closer */}
        <Section title="Proceso Closer" gradient="linear-gradient(135deg, rgba(52,211,153,0.08) 0%, rgba(52,211,153,0.04) 100%)">
          {editing ? (
            <EditField label="Un paso por línea" value={editBrief.proceso_closer || ''} onChange={v => setField('proceso_closer', v)} rows={5} />
          ) : (
            <StepList value={b.proceso_closer} />
          )}
        </Section>

        {/* Manejo de Objeciones */}
        <Section title="Manejo de Objeciones" gradient="linear-gradient(135deg, rgba(248,113,113,0.08) 0%, rgba(239,68,68,0.04) 100%)">
          {editing ? (
            <EditField label="" value={editBrief.manejo_objeciones || ''} onChange={v => setField('manejo_objeciones', v)} rows={5} />
          ) : (
            <TextField label="" value={b.manejo_objeciones} />
          )}
        </Section>

        {/* FAQ */}
        <Section title="Preguntas Frecuentes" gradient="linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(139,92,246,0.04) 100%)">
          {editing ? (
            <EditField label="" value={editBrief.preguntas_frecuentes || ''} onChange={v => setField('preguntas_frecuentes', v)} rows={5} />
          ) : (
            <TextField label="" value={b.preguntas_frecuentes} />
          )}
        </Section>

        {/* Argumentos de Cierre */}
        <Section title="Argumentos de Cierre" gradient="linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(99,102,241,0.06) 100%)">
          {editing ? (
            <EditField label="Un argumento por línea" value={editBrief.argumentos_cierre || ''} onChange={v => setField('argumentos_cierre', v)} rows={4} />
          ) : (
            <BulletList label="" value={b.argumentos_cierre} />
          )}
        </Section>

        {/* Comisiones */}
        {comisiones && (
          <Section title="Comisiones" gradient="linear-gradient(135deg, rgba(52,211,153,0.1) 0%, rgba(52,211,153,0.05) 100%)">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {comisiones.porcentaje_setter !== undefined && (
                <div style={{ textAlign: 'center', padding: '12px', background: '#080B14', borderRadius: 8, border: '1px solid #1a2234' }}>
                  <p style={{ color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Setter</p>
                  <p style={{ color: '#34D399', fontWeight: 700, fontSize: 20 }}>{comisiones.porcentaje_setter}%</p>
                </div>
              )}
              {comisiones.porcentaje_closer !== undefined && (
                <div style={{ textAlign: 'center', padding: '12px', background: '#080B14', borderRadius: 8, border: '1px solid #1a2234' }}>
                  <p style={{ color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Closer</p>
                  <p style={{ color: '#818CF8', fontWeight: 700, fontSize: 20 }}>{comisiones.porcentaje_closer}%</p>
                </div>
              )}
              {comisiones.monto_minimo !== undefined && (
                <div style={{ textAlign: 'center', padding: '12px', background: '#080B14', borderRadius: 8, border: '1px solid #1a2234' }}>
                  <p style={{ color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Mínimo</p>
                  <p style={{ color: '#FBBF24', fontWeight: 700, fontSize: 20 }}>${comisiones.monto_minimo?.toLocaleString()}</p>
                </div>
              )}
            </div>
            {comisiones.notas && <p style={{ color: '#64748B', fontSize: 12, marginTop: 12 }}>{comisiones.notas}</p>}
          </Section>
        )}

        {/* Notas adicionales */}
        {(editing || b.notas_adicionales) && (
          <Section title="Notas Adicionales" gradient="linear-gradient(135deg, rgba(71,85,105,0.15) 0%, rgba(71,85,105,0.08) 100%)">
            {editing ? (
              <EditField label="" value={editBrief.notas_adicionales || ''} onChange={v => setField('notas_adicionales', v)} rows={3} />
            ) : (
              <TextField label="" value={b.notas_adicionales} />
            )}
          </Section>
        )}

        {/* Observaciones Estratégicas */}
        {(editing || b.observaciones_estrategicas) && (
          <Section title="Observaciones Estratégicas" gradient="linear-gradient(135deg, rgba(248,113,113,0.08) 0%, rgba(251,191,36,0.06) 100%)">
            {editing ? (
              <EditField label="Observaciones y estrategia general" value={editBrief.observaciones_estrategicas || ''} onChange={v => setField('observaciones_estrategicas', v)} rows={5} />
            ) : (
              <TextField label="" value={b.observaciones_estrategicas} />
            )}
          </Section>
        )}

        {/* Audio Notes */}
        <div style={{ marginTop: 16 }}>
          <AudioRecorder entidadTipo="brief" entidadId={proyectoId} readOnly={readOnly} />
        </div>
      </div>
    </div>
  )
}
