import { useState, useEffect, lazy, Suspense, Component, ErrorInfo } from "react";
const PhotoCarousel = lazy(() => import("../carousel/PhotoCarousel"));
const FilmstripGallery = lazy(() => import("./FilmstripGallery"));

interface Photo {
  id?: string | number;
  src: string;
  alt: string;
  legend?: string;
}

interface DynamicGalleryProps {
  imageGlobPattern?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error in gallery component:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center text-red-500 border border-red-200 rounded">
          <p>Error loading gallery: {this.state.errorMessage || "Unknown error"}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const DynamicGallery: React.FC<DynamicGalleryProps> = ({ imageGlobPattern }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadImages() {
      try {
        setIsLoading(true);
        // Default to photography folder if no pattern provided
        // Cast import.meta to any to avoid TS error: Property 'glob' does not exist on type 'ImportMeta'
        const modules = (import.meta as any).glob("../../../assets/photography/*.{png,jpg,jpeg,svg,gif}", { eager: false });
        
        if (Object.keys(modules).length === 0) {
          // Fallback or empty state
          setPhotos([]);
          return;
        }

        const loadedPhotos: Photo[] = await Promise.all(
          Object.keys(modules).map(async (path: string, index: number) => {
            const module = await modules[path]();
            return {
              id: index,
              src: module.default,
              alt: `Gallery image ${index + 1}`,
            };
          })
        );
        setPhotos(loadedPhotos);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load images");
      } finally {
        setIsLoading(false);
      }
    }
    loadImages();
  }, [imageGlobPattern]);

  const handleCarouselChange = (index: number) => setCurrentSlide(index);
  const handleThumbnailClick = (index: number) => setCurrentSlide(index);

  if (isLoading) return <div className="p-10 text-center">Loading gallery...</div>;
  if (error) return <div className="p-10 text-center text-red-500">Error: {error}</div>;
  if (photos.length === 0) return <div className="p-10 text-center">No images found.</div>;

  return (
    <div className="w-full max-w-none sm:max-w-lg md:max-w-3xl px-2 sm:px-4 mx-auto">
      <ErrorBoundary>
        <Suspense fallback={<div className="p-10 text-center">Loading visualizer...</div>}>
          <PhotoCarousel photosData={photos} selectedItem={currentSlide} onChange={handleCarouselChange} />
          <FilmstripGallery photosData={photos} currentIndex={currentSlide} onThumbnailClick={handleThumbnailClick} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

export default DynamicGallery;