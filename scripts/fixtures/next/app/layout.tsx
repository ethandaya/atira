import '@atira/foundations/styles.css'
import '@atira/primitives/styles.css'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
