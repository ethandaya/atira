import '@pretty-amped/foundations/styles.css'
import '@pretty-amped/primitives/styles.css'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
