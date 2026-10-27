import { BotAvatar } from 'bot-avatars';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';

type BotType = NonNullable<ComponentProps<typeof BotAvatar>['type']>;

// Canvas avatar; idle by default, "works" while its parent segment is hovered
// or focused. Decorative — the segment's text label carries the accessible name.
export default function ActionBarAvatar({ type }: { type: BotType }) {
    const ref = useRef<HTMLSpanElement>(null);
    const [working, setWorking] = useState(false);

    useEffect(() => {
        const segment = ref.current?.closest('.action-bar-segment');
        if (!segment) return;
        const on = () => setWorking(true);
        const off = () => setWorking(false);
        segment.addEventListener('pointerenter', on);
        segment.addEventListener('pointerleave', off);
        segment.addEventListener('focusin', on);
        segment.addEventListener('focusout', off);
        return () => {
            segment.removeEventListener('pointerenter', on);
            segment.removeEventListener('pointerleave', off);
            segment.removeEventListener('focusin', on);
            segment.removeEventListener('focusout', off);
        };
    }, []);

    return (
        <span ref={ref} style={{ display: 'contents' }}>
            <BotAvatar
                type={type}
                size={32}
                state={working ? 'working' : 'default'}
                aria-hidden
            />
        </span>
    );
}
