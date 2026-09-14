// Install the clock before importing the app or Motion can cache native timing.
// Vite removes this branch and the inspector dependency from production builds.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('lapse')) {
  const { mountLapse } = await import('@aiforui/lapse/panel')
  mountLapse()
}

await import('./bootstrap')

export {}
