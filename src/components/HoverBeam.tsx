import { useState, type ReactNode } from 'react';
import { BorderBeam } from 'border-beam';
import { useReducedMotion } from '../utils/useReducedMotion';

interface HoverBeamProps {
    size?: 'sm' | 'md' | 'line' | 'pulse-outside' | 'pulse-inner';
    colorVariant?: 'colorful' | 'mono' | 'ocean' | 'sunset';
    strength?: number;
    borderRadius?: number;
    children?: ReactNode;
}

export default function HoverBeam({
    size = 'md',
    colorVariant = 'mono',
    strength = 0.7,
    borderRadius,
    children,
}: HoverBeamProps) {
    const [hovered, setHovered] = useState(false);
    const reduced = useReducedMotion();
    return (
        <span
            className="hover-beam"
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
        >
            <BorderBeam
                size={size}
                colorVariant={colorVariant}
                theme="dark"
                strength={strength}
                borderRadius={borderRadius}
                active={hovered && !reduced}
                style={{ display: 'inline-flex' }}
            >
                {children}
            </BorderBeam>
        </span>
    );
}
