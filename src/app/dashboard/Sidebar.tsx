'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Receipt, Wallet, Users2, FileText,
  Award, ChevronDown, ChevronRight, Menu, X,
  BarChart2, FolderOpen, UserCheck, Settings, Megaphone, Shield,
  BookOpen, Handshake, Radio, ShieldCheck
} from 'lucide-react'

const C = {
  bg: '#080B14', surface: '#0D1117', card: '#111827',
  border: '#1a2234', borderLight: '#1F2937',
  text: '#F1F5F9', textMuted: '#94A3B8', textDim: '#475569', textDark: '#334155',
  accent: '#6366F1', accentLight: '#818CF8',
  green: '#34D399', red: '#F87171', yellow: '#FBBF24', orange: '#FB923C',
}

interface NavItem {
  label: string
  href?: string
  icon: React.ElementType
  children?: { label: string; href: string }[]
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    children: [
      { label: 'Operaciones', href: '/dashboard' },
      { label: 'Facturación', href: '/dashboard/facturacion' },
    ],
  },
  { label: 'Transacciones', href: '/dashboard/transacciones', icon: Receipt },
  {
    label: 'Cartera',
    icon: Wallet,
    children: [
      { label: 'Resumen', href: '/dashboard/facturacion/cartera' },
      { label: 'Liquidaciones', href: '/dashboard/facturacion/liquidaciones' },
    ],
  },
  { label: 'Clientes', href: '/dashboard/clientes', icon: Users2 },
  {
    label: 'Briefs',
    icon: BookOpen,
    children: [
      { label: 'Por Proyecto', href: '/dashboard/proyectos' },
    ],
  },
  { label: 'Equipo', href: '/dashboard/equipo', icon: UserCheck },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart2 },
  { label: 'Comisiones', href: '/dashboard/comisiones', icon: Award },
  // Preparados para futuro
  { label: 'Socio', href: '/dashboard/socio', icon: Handshake },
  { label: 'Tráfico', href: '/dashboard/trafico', icon: Radio },
  { label: 'Administración', href: '/dashboard/admin', icon: ShieldCheck },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => {
    // Auto-expand Dashboard group if user is on dashboard or facturacion
    if (pathname === '/dashboard' || pathname === '/dashboard/facturacion') return 'Dashboard'
    return null
  })

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  function isGroupActive(item: NavItem) {
    if (item.children) return item.children.some(c => isActive(c.href))
    return item.href ? isActive(item.href) : false
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
        <img src="/arete.png" alt="Areté" className="w-7 h-7 object-contain" />
        {!collapsed && (
          <span className="text-sm font-bold tracking-tight whitespace-nowrap" style={{ color: C.text }}>
            Areté Sales OS
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon
          const active = isGroupActive(item)
          const hasChildren = !!item.children
          const isExpanded = expandedGroup === item.label

          if (hasChildren) {
            return (
              <div key={item.label}>
                <button
                  onClick={() => setExpandedGroup(isExpanded ? null : item.label)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group"
                  style={{
                    background: active ? `${C.accent}12` : 'transparent',
                    color: active ? C.accentLight : C.textDim,
                  }}
                >
                  <Icon size={18} style={{ color: active ? C.accentLight : C.textDim, flexShrink: 0 }} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-[13px] font-semibold">{item.label}</span>
                      <ChevronDown
                        size={14}
                        className="transition-transform"
                        style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', color: C.textDark }}
                      />
                    </>
                  )}
                </button>
                {isExpanded && !collapsed && (
                  <div className="ml-5 pl-3 mt-0.5 space-y-0.5" style={{ borderLeft: `2px solid ${C.border}` }}>
                    {item.children!.map(child => {
                      const childActive = isActive(child.href)
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setMobileOpen(false)}
                          className="block px-3 py-2 rounded-lg text-[12px] font-medium transition-all"
                          style={{
                            background: childActive ? `${C.accent}15` : 'transparent',
                            color: childActive ? C.accentLight : C.textDim,
                          }}
                        >
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.label}
              href={item.href!}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group"
              style={{
                background: active ? `${C.accent}12` : 'transparent',
                color: active ? C.accentLight : C.textDim,
              }}
            >
              <Icon size={18} style={{ color: active ? C.accentLight : C.textDim, flexShrink: 0 }} />
              {!collapsed && (
                <span className="text-[13px] font-semibold">{item.label}</span>
              )}
              {active && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: C.accent }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle (desktop) */}
      <div className="hidden lg:flex items-center justify-center py-3 shrink-0" style={{ borderTop: `1px solid ${C.border}` }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg transition-all hover:bg-white/5"
          style={{ color: C.textDark }}
        >
          <ChevronRight size={16} className="transition-transform" style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }} />
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-[61] p-2 rounded-lg"
        style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.textMuted }}
      >
        <Menu size={18} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]" onClick={() => setMobileOpen(false)} style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div
            className="w-64 h-full"
            onClick={e => e.stopPropagation()}
            style={{ background: C.surface, borderRight: `1px solid ${C.border}` }}
          >
            <div className="flex justify-end p-2">
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: C.textDim }}>
                <X size={16} />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col fixed top-0 left-0 h-screen z-40 transition-all duration-200"
        style={{
          width: collapsed ? 64 : 220,
          background: C.surface,
          borderRight: `1px solid ${C.border}`,
        }}
      >
        {sidebarContent}
      </aside>

      {/* Spacer for content */}
      <div
        className="hidden lg:block shrink-0 transition-all duration-200"
        style={{ width: collapsed ? 64 : 220 }}
      />
    </>
  )
}
