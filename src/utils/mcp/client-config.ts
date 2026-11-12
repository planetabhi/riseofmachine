import { splitCommandWords } from './install';

// Derive the `mcpServers` config block clients paste from the install command.
// Leading `KEY=<value>` tokens become `env`; the rest is command + args.
export function buildClientConfig(d: DOMStringMap): string {
    const kind = d.installKind || 'none';
    const cmd = (d.installCommand || '').trim();
    if (kind === 'none' || !cmd) return '';
    const key = d.slug || 'server';
    let entry: Record<string, unknown>;
    if (kind === 'remote') {
        // Preserve the remote transport so clients can tell SSE from Streamable HTTP.
        const transports = (d.transports || '').split(',').map((t) => t.trim());
        entry = transports.includes('sse') ? { type: 'sse', url: cmd } : { type: 'http', url: cmd };
    } else {
        const tokens = /^(?:[A-Za-z_][A-Za-z0-9_]*='<value>' )*docker run /.test(cmd)
            ? splitCommandWords(cmd)
            : cmd.split(' ').filter(Boolean);
        const env: Record<string, string> = {};
        let i = 0;
        for (; i < tokens.length; i++) {
            const m = tokens[i]!.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.+)$/);
            if (!m) break;
            env[m[1]!] = m[2]!;
        }
        const rest = tokens.slice(i);
        if (rest.length === 0) return '';
        // `mcpb install <bundle>` is a bundle installer, not a server launch; skip it.
        if (rest[0] === 'mcpb' && rest[1] === 'install') return '';
        entry = { command: rest[0], args: rest.slice(1) };
        if (Object.keys(env).length) entry.env = env;
    }
    return JSON.stringify({ mcpServers: { [key]: entry } }, null, 2);
}
