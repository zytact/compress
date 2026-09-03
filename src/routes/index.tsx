import { createFileRoute } from '@tanstack/react-router';
import ImageCompressor from '@/components/ui/image-compressor';

export const Route = createFileRoute('/')({ component: App });

function App() {
    return <ImageCompressor />;
}
