/**
 * Serialize a value to a JSON-LD string that is safe to embed inside a
 * <script type="application/ld+json"> tag.
 *
 * JSON.stringify does not escape `<`, `>` or `/`, so data containing the
 * literal sequence `</script>` (or `<!--`) could break out of the script
 * element. We escape those characters using unicode escapes, which keep the
 * output valid JSON while preventing HTML parser confusion.
 */
export function serializeJsonLd(value: unknown): string {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}
