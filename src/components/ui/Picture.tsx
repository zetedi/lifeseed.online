import React, { useState } from 'react';
import { imageVariantUrlOf, type ImageVariantSize } from '../../domain/imageVariant';

// A picture shown in a seat. Asks the bucket for the variant that fits (480 for cards and
// avatars, 1200 for heroes) and falls back to the primary when the variant is not there —
// a just-uploaded picture's variants arrive seconds later; a foreign URL never has any.
// Lazy and async by default; a seat above the fold may pass loading="eager".
type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string; size?: ImageVariantSize };

export const Picture: React.FC<Props> = ({ src, size = 480, onError, loading = 'lazy', decoding = 'async', ...rest }) => {
    // The src the variant fell for — a new src starts clean without an effect.
    const [fallenFor, setFallenFor] = useState<string | undefined>(undefined);
    const fallen = !!src && fallenFor === src;
    const variant = src ? imageVariantUrlOf(src, size) : '';
    const shown = !src || fallen || variant === src ? src : variant;
    return (
        <img
            {...rest}
            src={shown}
            loading={loading}
            decoding={decoding}
            onError={(e) => {
                onError?.(e);
                if (!fallen && variant !== src) setFallenFor(src);
            }}
        />
    );
};
