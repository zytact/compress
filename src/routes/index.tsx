import { createFileRoute } from '@tanstack/react-router'
import { ModeToggle } from '@/components/mode-toggle'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <div className="relative h-screen overflow-auto">
      <div className="flex absolute top-2 right-2">
        <ModeToggle />
      </div>
    </div>
  )
}
