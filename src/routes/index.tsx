import { createFileRoute } from '@tanstack/react-router';
import { ModeToggle } from '@/components/ui/mode-toggle';
import ImageCompressor from '@/components/ui/image-compressor';

export const Route = createFileRoute('/')({ component: App });

function App() {
    return (
        <div className="relative h-screen overflow-auto">
            <div className="flex absolute top-2 right-2">
                <ModeToggle />
            </div>
            <ImageCompressor />
        </div>
    );
}
