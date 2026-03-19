'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  async function signIn() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#F4FAFE',
        fontFamily: "'Outfit', sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      {/* Ambient blobs */}
      <div style={{
        position: 'fixed', top: '-80px', left: '50%', transform: 'translateX(-50%)',
        width: '480px', height: '480px', borderRadius: '50%',
        background: 'radial-gradient(circle, #C4E8F4 0%, transparent 70%)',
        opacity: 0.45, pointerEvents: 'none', filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'fixed', bottom: '-100px', right: '-60px',
        width: '360px', height: '360px', borderRadius: '50%',
        background: 'radial-gradient(circle, #FDFACC 0%, transparent 70%)',
        opacity: 0.5, pointerEvents: 'none', filter: 'blur(48px)',
      }} />

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '360px',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '72px', height: '72px',
            background: '#2E1A0E',
            borderRadius: '22px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 32px rgba(46,26,14,0.2)',
            fontSize: '32px',
          }}>⚔️</div>
          <h1 style={{
            fontSize: '28px', fontWeight: 900,
            color: '#2E1A0E', letterSpacing: '-0.04em',
            margin: 0,
          }}>DREAM OS</h1>
          <p style={{
            fontSize: '11px', fontWeight: 600,
            color: '#A07850', letterSpacing: '0.18em',
            textTransform: 'uppercase', marginTop: '4px',
          }}>Personal Project OS</p>
        </div>

        {/* Sign in card */}
        <div style={{
          background: '#fff',
          borderRadius: '1.375rem',
          padding: '2rem',
          boxShadow: '0 4px 32px rgba(46,26,14,0.08)',
          border: '1px solid rgba(196,232,244,0.5)',
        }}>
          <p style={{
            fontSize: '13px', color: '#A07850', fontWeight: 500,
            marginBottom: '1.25rem', textAlign: 'center',
          }}>
            ล็อกอินเพื่อเริ่มจัดการ quests ของคุณ
          </p>

          {/* Google button */}
          <button
            onClick={signIn}
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 20px',
              background: loading ? 'rgba(46,26,14,0.06)' : '#2E1A0E',
              color: loading ? '#A07850' : '#FDFACC',
              border: 'none',
              borderRadius: '0.875rem',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'Outfit', sans-serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'all 0.2s ease',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(46,26,14,0.22)',
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: '16px', height: '16px',
                  borderRadius: '50%',
                  border: '2px solid rgba(160,120,80,0.3)',
                  borderTopColor: '#A07850',
                  animation: 'spin 0.7s linear infinite',
                  flexShrink: 0,
                }} />
                กำลังเข้าสู่ระบบ...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path fill="#fff" fillOpacity="0.9" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#fff" fillOpacity="0.75" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#fff" fillOpacity="0.6" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#fff" fillOpacity="0.85" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          {/* Divider hint */}
          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(196,232,244,0.5)' }} />
            <span style={{ fontSize: '10px', color: '#A07850', fontWeight: 500 }}>SECURE LOGIN</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(196,232,244,0.5)' }} />
          </div>

          <p style={{
            fontSize: '11px', color: '#A07850', textAlign: 'center',
            marginTop: '1rem', lineHeight: 1.6, opacity: 0.8,
          }}>
            ข้อมูลของคุณถูกเข้ารหัสและจัดเก็บอย่างปลอดภัย<br />
            ผ่าน Supabase + Google OAuth
          </p>
        </div>

        {/* Feature pills */}
        <div style={{
          display: 'flex', gap: '8px', justifyContent: 'center',
          marginTop: '1.5rem', flexWrap: 'wrap',
        }}>
          {['⚔️ Quest Chain', '🍅 Pomodoro', '🌿 Habits', '📋 Sprint Board'].map(f => (
            <span key={f} style={{
              fontSize: '11px', fontWeight: 600,
              color: '#5C3D26',
              background: 'rgba(196,232,244,0.35)',
              padding: '5px 12px',
              borderRadius: '999px',
              border: '1px solid rgba(196,232,244,0.5)',
            }}>{f}</span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
