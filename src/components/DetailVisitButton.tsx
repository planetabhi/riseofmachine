import { useState } from 'react';
import { BorderBeam } from 'border-beam';
import { useReducedMotion } from '../utils/useReducedMotion';

// Visit-site action for the detail panel. Default is a plain mono outline
// (the anchor's own border); hovering activates the colorful rotating beam.
// The anchor keeps id="detail-visit" so the panel script can set its href.
export default function DetailVisitButton() {
    const [hover, setHover] = useState(false);
    const reduced = useReducedMotion();

    return (
        <BorderBeam
            size="md"
            colorVariant="colorful"
            theme="dark"
            active={hover && !reduced}
            style={{ display: 'block' }}
        >
            <a
                className="detail-action detail-action--primary t-learn"
                id="detail-visit"
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
            >
                Visit site
                <span className="t-learn-chevron" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 20 20">
                        <path d="M10.4121 2.22217C10.4121 6.51769 14.2588 9.9999 19.0039 9.9999C14.2588 9.9999 10.4121 13.4822 10.4121 17.7777M18.9746 9.99995H0" stroke="currentColor" strokeWidth="1" />
                    </svg>
                </span>
            </a>
        </BorderBeam>
    );
}
