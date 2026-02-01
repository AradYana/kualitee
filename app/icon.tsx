import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)',
          borderRadius: '8px',
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'white',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          K
        </span>
      </div>
    ),
    {
      ...size,
    }
  )
}
